/**
 * Repository-Schicht: die einzige Stelle, die auf die Datenbank zugreift.
 * Ein späteres Backend ersetzt nur diese Datei.
 */
import { db } from './db'
import type { Dish, ShopItem, Slot } from './types'
import { buildPlanItems, mergeShoppingList, normalizeName } from '../lib/shopping'
import { guessCategory } from '../lib/categories'

export const newId = () => crypto.randomUUID()

// ---------- Menüs ----------
export type DishInput = Omit<Dish, 'id' | 'updatedAt'> & { id?: string }

export async function saveDish(input: DishInput): Promise<string> {
  const id = input.id ?? newId()
  await db.dishes.put({ ...input, id, updatedAt: Date.now() })
  return id
}

export async function deleteDish(id: string) {
  await db.transaction('rw', db.dishes, db.plan, async () => {
    await db.plan.where('dishId').equals(id).delete()
    await db.dishes.delete(id)
  })
}

// ---------- Wochenplan ----------
export async function assignDish(date: string, slot: Slot, dishId: string) {
  const dish = await db.dishes.get(dishId)
  await db.transaction('rw', db.plan, async () => {
    await db.plan.where('[date+slot]').equals([date, slot]).delete()
    await db.plan.add({
      id: newId(),
      date,
      slot,
      dishId,
      servings: dish?.servings ?? 2,
      updatedAt: Date.now(),
    })
  })
}

export async function setPlanServings(id: string, servings: number) {
  await db.plan.update(id, { servings: Math.max(1, servings), updatedAt: Date.now() })
}

export const removePlanEntry = (id: string) => db.plan.delete(id)

/** Verschiebt einen Eintrag; ist das Ziel belegt, werden beide getauscht. */
export async function moveEntry(id: string, date: string, slot: Slot) {
  await db.transaction('rw', db.plan, async () => {
    const src = await db.plan.get(id)
    if (!src || (src.date === date && src.slot === slot)) return
    const target = await db.plan.where('[date+slot]').equals([date, slot]).first()
    const now = Date.now()
    if (target) await db.plan.update(target.id, { date: src.date, slot: src.slot, updatedAt: now })
    await db.plan.update(src.id, { date, slot, updatedAt: now })
  })
}

// ---------- Einkaufsliste ----------
export async function categoryForName(name: string): Promise<string> {
  const n = normalizeName(name)
  const known = await db.ingredientCategories.get(n)
  return known?.categoryId ?? guessCategory(n)
}

export async function setItemCategory(item: ShopItem, categoryId: string) {
  await db.transaction('rw', db.shop, db.ingredientCategories, async () => {
    await db.shop.update(item.id, { categoryId, updatedAt: Date.now() })
    await db.ingredientCategories.put({ name: normalizeName(item.name), categoryId })
  })
}

export async function addManualItem(name: string, qty?: number, unit?: string) {
  const categoryId = await categoryForName(name)
  await db.shop.add({
    id: newId(),
    name: name.trim(),
    qty,
    unit,
    categoryId,
    checked: false,
    source: 'manual',
    updatedAt: Date.now(),
  })
}

export async function updateItem(item: ShopItem, patch: Partial<ShopItem>) {
  const edited = item.source === 'plan' && ('qty' in patch || 'unit' in patch) ? true : item.edited
  await db.shop.update(item.id, { ...patch, edited, updatedAt: Date.now() })
}

export const toggleItem = (item: ShopItem) =>
  db.shop.update(item.id, { checked: !item.checked, updatedAt: Date.now() })

export const deleteItem = (id: string) => db.shop.delete(id)

/**
 * Entfernt einen Artikel von der Liste. Plan-Artikel werden nur ausgeblendet («habe ich schon»),
 * damit sie beim erneuten Generieren nicht zurückkommen.
 */
export const removeItem = (item: ShopItem) =>
  item.source === 'plan'
    ? db.shop.update(item.id, { dismissed: true, checked: false, updatedAt: Date.now() })
    : db.shop.delete(item.id)

export const undismissItem = (item: ShopItem) =>
  db.shop.update(item.id, { dismissed: false, updatedAt: Date.now() })

export const clearChecked = () => db.shop.filter((i) => i.checked).delete()

/** Erzeugt/aktualisiert die Plan-Einträge der Liste für den Zeitraum [from, to]. */
export async function generateShoppingList(from: string, to: string) {
  const entries = await db.plan.where('date').between(from, to, true, true).toArray()
  const dishes = new Map((await db.dishes.toArray()).map((d) => [d.id, d]))
  const planItems = buildPlanItems(entries, dishes)

  const cats = new Map((await db.ingredientCategories.toArray()).map((c) => [c.name, c.categoryId]))
  const existing = await db.shop.toArray()
  const result = mergeShoppingList(
    existing,
    planItems,
    (n) => cats.get(n) ?? guessCategory(n),
    newId,
    Date.now(),
  )
  await db.transaction('rw', db.shop, async () => {
    await db.shop.bulkPut(result.upsert)
    await db.shop.bulkDelete(result.deleteIds)
  })
  return { added: result.upsert.length, removed: result.deleteIds.length, total: planItems.length }
}

/**
 * Schliesst den Einkauf ab: speichert die ganze Liste im Archiv und leert sie.
 * Mit keepUnchecked bleiben nicht abgehakte Artikel in der aktiven Liste.
 */
export async function closeShoppingList(keepUnchecked: boolean): Promise<string | null> {
  return db.transaction('rw', db.shop, db.archive, async () => {
    const all = await db.shop.toArray()
    const items = all.filter((i) => !i.dismissed)
    if (items.length === 0) return null
    const id = newId()
    await db.archive.add({ id, closedAt: Date.now(), items })
    const keep = new Set(items.filter((i) => keepUnchecked && !i.checked).map((i) => i.id))
    await db.shop.bulkDelete(all.filter((i) => !keep.has(i.id)).map((i) => i.id))
    return id
  })
}

/** Übernimmt alle Artikel eines archivierten Einkaufs als neue, offene Artikel. */
export async function restoreArchived(id: string): Promise<number> {
  const entry = await db.archive.get(id)
  if (!entry) return 0
  const now = Date.now()
  await db.shop.bulkAdd(
    entry.items.map((i) => ({
      id: newId(),
      name: i.name,
      qty: i.qty,
      unit: i.unit,
      categoryId: i.categoryId,
      checked: false,
      source: 'manual' as const,
      updatedAt: now,
    })),
  )
  return entry.items.length
}

export const deleteArchived = (id: string) => db.archive.delete(id)

// ---------- Backup ----------
export async function exportAll(): Promise<string> {
  const data = {
    version: 1,
    dishes: await db.dishes.toArray(),
    plan: await db.plan.toArray(),
    shop: await db.shop.toArray(),
    categories: await db.categories.toArray(),
    archive: await db.archive.toArray(),
    ingredientCategories: await db.ingredientCategories.toArray(),
  }
  return JSON.stringify(data, null, 2)
}

export async function importAll(json: string) {
  const data = JSON.parse(json)
  if (!data || data.version !== 1 || !Array.isArray(data.dishes)) throw new Error('Ungültige Backup-Datei')
  await db.transaction(
    'rw',
    [db.dishes, db.plan, db.shop, db.categories, db.ingredientCategories, db.archive],
    async () => {
      await Promise.all([
        db.dishes.clear(),
        db.plan.clear(),
        db.shop.clear(),
        db.categories.clear(),
        db.archive.clear(),
        db.ingredientCategories.clear(),
      ])
      await db.dishes.bulkAdd(data.dishes)
      await db.plan.bulkAdd(data.plan ?? [])
      await db.shop.bulkAdd(data.shop ?? [])
      await db.categories.bulkAdd(data.categories ?? [])
      await db.archive.bulkAdd(data.archive ?? [])
      await db.ingredientCategories.bulkAdd(data.ingredientCategories ?? [])
    },
  )
}
