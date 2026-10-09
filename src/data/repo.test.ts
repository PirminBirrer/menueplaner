import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addManualItem, closeShoppingList, deleteArchived, exportAll, importAll, restoreArchived, toggleItem } from './repo'

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
