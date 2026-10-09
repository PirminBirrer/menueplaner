import { describe, expect, it } from 'vitest'
import type { Dish, PlanEntry, ShopItem } from '../data/types'
import { buildPlanItems, mergeShoppingList } from './shopping'
import { formatQuantity, parseIngredientLine } from './units'

type Ing = [number | undefined, string | undefined, string]

const dish = (id: string, name: string, servings: number | undefined, ings: Ing[]): Dish => ({
  id,
  name,
  tags: [],
  servings,
  ingredients: ings.map(([qty, unit, n], i) => ({ id: `${id}${i}`, qty, unit, name: n })),
  updatedAt: 0,
})
const entry = (
  dishId: string,
  servings: number,
  date = '2026-10-12',
  slot: 'lunch' | 'dinner' = 'dinner',
): PlanEntry => ({ id: `${dishId}${date}${slot}`, date, slot, dishId, servings, updatedAt: 0 })
const map = (...d: Dish[]) => new Map(d.map((x) => [x.id, x]))

describe('buildPlanItems', () => {
  it('skaliert auf geplante Portionen', () => {
    const pasta = dish('p', 'Pasta', 2, [[200, 'g', 'Spaghetti']])
    const items = buildPlanItems([entry('p', 4)], map(pasta))
    expect(items).toMatchObject([{ name: 'Spaghetti', qty: 400, unit: 'g' }])
  })

  it('zählt gleiche Zutaten zusammen (2x 100 g Butter → 200 g)', () => {
    const a = dish('a', 'A', 1, [[100, 'g', 'Butter']])
    const b = dish('b', 'B', 1, [[100, 'g', 'butter']])
    const items = buildPlanItems([entry('a', 1), entry('b', 1, '2026-10-13')], map(a, b))
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ qty: 200, unit: 'g' })
  })

  it('rechnet metrisch um (500 g + 1 kg = 1.5 kg, 2 dl + 1 l = 1200 ml)', () => {
    const a = dish('a', 'A', 1, [
      [500, 'g', 'Mehl'],
      [2, 'dl', 'Milch'],
    ])
    const b = dish('b', 'B', 1, [
      [1, 'kg', 'Mehl'],
      [1, 'l', 'Milch'],
    ])
    const items = buildPlanItems([entry('a', 1), entry('b', 1, '2026-10-13')], map(a, b))
    const mehl = items.find((i) => i.name === 'Mehl')!
    const milch = items.find((i) => i.name === 'Milch')!
    expect(formatQuantity(mehl.qty, mehl.unit)).toBe('1.5 kg')
    expect(milch).toMatchObject({ qty: 1200, unit: 'ml' })
  })

  it('trennt unverträgliche Einheiten', () => {
    const a = dish('a', 'A', 1, [
      [1, 'EL', 'Öl'],
      [50, 'ml', 'Öl'],
    ])
    expect(buildPlanItems([entry('a', 1)], map(a))).toHaveLength(2)
  })

  it('Menü ohne Rezept erscheint mit Namen', () => {
    const pizza = dish('z', 'Pizza vom Beck', undefined, [])
    const items = buildPlanItems([entry('z', 2)], map(pizza))
    expect(items).toMatchObject([{ name: 'Pizza vom Beck' }])
  })

  it('skaliert nicht, wenn Rezept keine Portionen hat', () => {
    const a = dish('a', 'A', undefined, [[3, undefined, 'Eier']])
    expect(buildPlanItems([entry('a', 4)], map(a))[0].qty).toBe(3)
  })

  it('Zutat ohne Menge bleibt ohne Menge', () => {
    const a = dish('a', 'A', 2, [[undefined, undefined, 'Salz']])
    const items = buildPlanItems([entry('a', 2), entry('a', 2, '2026-10-13')], map(a))
    expect(items).toMatchObject([{ name: 'Salz', qty: undefined }])
  })
})

describe('mergeShoppingList', () => {
  const cat = () => 'sonstiges'
  let n = 0
  const id = () => `new${n++}`
  const planItem = (over: Partial<ShopItem>): ShopItem => ({
    id: 'x',
    name: 'Butter',
    qty: 100,
    unit: 'g',
    categoryId: 'milch',
    checked: false,
    source: 'plan',
    planKey: 'butter|g',
    updatedAt: 0,
    ...over,
  })
  const butter = { key: 'butter|g', name: 'Butter', qty: 250, unit: 'g' }

  it('behält manuelle Artikel und Abhak-Status', () => {
    const manual = planItem({ id: 'm', source: 'manual', planKey: undefined, name: 'Zahnpasta' })
    const checked = planItem({ id: 'c', checked: true })
    const r = mergeShoppingList([manual, checked], [butter], cat, id, 1)
    expect(r.deleteIds).toEqual([])
    expect(r.upsert).toHaveLength(1)
    expect(r.upsert[0]).toMatchObject({ id: 'c', checked: true, qty: 250 })
  })

  it('überschreibt bearbeitete Mengen nicht', () => {
    const r = mergeShoppingList([planItem({ edited: true, qty: 5 })], [butter], cat, id, 1)
    expect(r.upsert).toEqual([])
  })

  it('entfernt veraltete Plan-Einträge, aber nicht abgehakte', () => {
    const stale = planItem({ id: 's' })
    const done = planItem({ id: 'd', planKey: 'milch|ml', checked: true })
    const r = mergeShoppingList([stale, done], [], cat, id, 1)
    expect(r.deleteIds).toEqual(['s'])
  })

  it('legt neue Einträge mit Kategorie an', () => {
    const r = mergeShoppingList([], [{ key: 'reis|g', name: 'Reis', qty: 300, unit: 'g' }], () => 'vorrat', id, 1)
    expect(r.upsert[0]).toMatchObject({ name: 'Reis', categoryId: 'vorrat', checked: false, source: 'plan' })
  })
})

describe('units', () => {
  it('parst Zutatenzeilen', () => {
    expect(parseIngredientLine('200 g Spaghetti')).toEqual({ qty: 200, unit: 'g', name: 'Spaghetti' })
    expect(parseIngredientLine('1,5 l Milch')).toEqual({ qty: 1.5, unit: 'l', name: 'Milch' })
    expect(parseIngredientLine('2 Eier')).toEqual({ qty: 2, name: 'Eier' })
    expect(parseIngredientLine('Salz')).toEqual({ name: 'Salz' })
  })
})
