import type { Dish, PlanEntry, ShopItem } from '../data/types'
import { toBase } from './units'

export interface PlanItem {
  key: string
  name: string
  qty?: number
  unit?: string
}

export const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Aggregiert die Zutaten der geplanten Menüs:
 * - skaliert auf die geplanten Portionen
 * - zählt gleiche Zutaten mit kompatibler Einheit zusammen (g/kg, ml/dl/l)
 * - Menüs ohne Rezept erscheinen mit ihrem Namen
 */
export function buildPlanItems(entries: PlanEntry[], dishes: Map<string, Dish>): PlanItem[] {
  const acc = new Map<string, PlanItem>()

  for (const entry of entries) {
    const dish = dishes.get(entry.dishId)
    if (!dish) continue

    const ingredients = dish.ingredients.filter((i) => i.name.trim())
    if (ingredients.length === 0) {
      const key = `dish|${dish.id}`
      const existing = acc.get(key)
      if (existing) existing.qty = (existing.qty ?? 1) + 1
      else acc.set(key, { key, name: dish.name })
      continue
    }

    const factor = dish.servings && dish.servings > 0 ? entry.servings / dish.servings : 1
    for (const ing of ingredients) {
      const scaled = ing.qty === undefined ? undefined : ing.qty * factor
      const base = toBase(scaled, ing.unit)
      const key = `${normalizeName(ing.name)}|${base.unit}`
      const existing = acc.get(key)
      if (existing) {
        if (base.qty !== undefined) existing.qty = (existing.qty ?? 0) + base.qty
      } else {
        acc.set(key, { key, name: ing.name.trim(), qty: base.qty, unit: base.unit || undefined })
      }
    }
  }
  return [...acc.values()]
}

export interface MergeResult {
  upsert: ShopItem[]
  deleteIds: string[]
}

/**
 * Gleicht die bestehende Liste mit den Plan-Einträgen ab, ohne manuelle Artikel
 * oder den Abhak-Status zu überschreiben.
 */
export function mergeShoppingList(
  existing: ShopItem[],
  planItems: PlanItem[],
  categoryFor: (normalizedName: string) => string,
  newId: () => string,
  now: number,
): MergeResult {
  const upsert: ShopItem[] = []
  const deleteIds: string[] = []
  const byKey = new Map<string, ShopItem>()
  for (const item of existing) if (item.source === 'plan' && item.planKey) byKey.set(item.planKey, item)

  const seen = new Set<string>()
  for (const p of planItems) {
    seen.add(p.key)
    const cur = byKey.get(p.key)
    if (!cur) {
      upsert.push({
        id: newId(),
        name: p.name,
        qty: p.qty,
        unit: p.unit,
        categoryId: categoryFor(normalizeName(p.name)),
        checked: false,
        source: 'plan',
        planKey: p.key,
        updatedAt: now,
      })
    } else if (!cur.edited && (cur.qty !== p.qty || cur.unit !== p.unit)) {
      upsert.push({ ...cur, qty: p.qty, unit: p.unit, updatedAt: now })
    }
  }

  for (const item of existing) {
    if (item.source !== 'plan' || !item.planKey || seen.has(item.planKey)) continue
    // Abgehakte oder bearbeitete Einträge bleiben erhalten.
    if (!item.checked && !item.edited) deleteIds.push(item.id)
  }
  return { upsert, deleteIds }
}
