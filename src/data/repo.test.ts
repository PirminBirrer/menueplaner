import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addManualItem,
  closeShoppingList,
  deleteArchived,
  exportAll,
  generateShoppingList,
  importAll,
  removeItem,
  restoreArchived,
  saveDish,
  assignDish,
  toggleItem,
  undismissItem,
} from './repo'

beforeEach(async () => {
  await Promise.all([db.shop.clear(), db.archive.clear()])
  await addManualItem('Milch', 2, 'l')
  await addManualItem('Zahnpasta')
  const milch = (await db.shop.toArray()).find((i) => i.name === 'Milch')!
  await toggleItem(milch)
})

describe('closeShoppingList', () => {
  it('archiviert die ganze Liste und behält nur Nicht-Abgehakte', async () => {
    const id = await closeShoppingList(true)
    const archived = await db.archive.get(id!)
    expect(archived!.items).toHaveLength(2)
    expect(archived!.items.find((i) => i.name === 'Milch')!.checked).toBe(true)
    const left = await db.shop.toArray()
    expect(left.map((i) => i.name)).toEqual(['Zahnpasta'])
  })

  it('leert die Liste komplett ohne Übernahme', async () => {
    await closeShoppingList(false)
    expect(await db.shop.count()).toBe(0)
    expect(await db.archive.count()).toBe(1)
  })

  it('archiviert nichts bei leerer Liste', async () => {
    await db.shop.clear()
    expect(await closeShoppingList(true)).toBeNull()
    expect(await db.archive.count()).toBe(0)
  })
})

describe('Archiv', () => {
  it('stellt Artikel als offene Artikel wieder her und löscht Einträge', async () => {
    const id = (await closeShoppingList(false))!
    expect(await restoreArchived(id)).toBe(2)
    const items = await db.shop.toArray()
    expect(items.every((i) => !i.checked)).toBe(true)
    await deleteArchived(id)
    expect(await db.archive.count()).toBe(0)
  })

  it('wird mit Export/Import gesichert', async () => {
    await closeShoppingList(false)
    const json = await exportAll()
    await db.archive.clear()
    await importAll(json)
    expect(await db.archive.count()).toBe(1)
  })
})

describe('«Habe ich schon»', () => {
  async function planReis() {
    await Promise.all([db.dishes.clear(), db.plan.clear(), db.shop.clear()])
    const id = await saveDish({ name: 'Risotto', tags: [], servings: 2, ingredients: [{ id: 'i', qty: 200, unit: 'g', name: 'Reis' }] })
    await assignDish('2026-10-12', 'dinner', id)
    await generateShoppingList('2026-10-12', '2026-10-12')
    return (await db.shop.toArray())[0]
  }

  it('blendet Plan-Artikel aus und fügt sie beim erneuten Generieren nicht wieder hinzu', async () => {
    const reis = await planReis()
    await removeItem(reis)
    await generateShoppingList('2026-10-12', '2026-10-12')
    const all = await db.shop.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].dismissed).toBe(true)
  })

  it('lässt sich zurück auf die Liste holen', async () => {
    const reis = await planReis()
    await removeItem(reis)
    await undismissItem((await db.shop.get(reis.id))!)
    expect((await db.shop.get(reis.id))!.dismissed).toBe(false)
  })

  it('löscht manuelle Artikel wirklich', async () => {
    await db.shop.clear()
    await addManualItem('Zahnpasta')
    await removeItem((await db.shop.toArray())[0])
    expect(await db.shop.count()).toBe(0)
  })

  it('archiviert ausgeblendete Artikel nicht und räumt sie beim Abschliessen auf', async () => {
    const reis = await planReis()
    await addManualItem('Milch')
    await removeItem(reis)
    const id = await closeShoppingList(true)
    expect((await db.archive.get(id!))!.items.map((i) => i.name)).toEqual(['Milch'])
    expect(await db.shop.filter((i) => !!i.dismissed).count()).toBe(0)
  })
})
