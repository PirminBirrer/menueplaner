import Dexie, { type EntityTable } from 'dexie'
import type { Category, Dish, IngredientCategory, PlanEntry, ShopItem } from './types'
import { DEFAULT_CATEGORIES } from '../lib/categories'

export class AppDB extends Dexie {
  dishes!: EntityTable<Dish, 'id'>
  plan!: EntityTable<PlanEntry, 'id'>
  shop!: EntityTable<ShopItem, 'id'>
  categories!: EntityTable<Category, 'id'>
  ingredientCategories!: EntityTable<IngredientCategory, 'name'>

  constructor(name = 'menueplaner') {
    super(name)
    this.version(1).stores({
      dishes: 'id, name, updatedAt',
      plan: 'id, date, [date+slot], dishId',
      shop: 'id, source, planKey',
      categories: 'id, sortOrder',
      ingredientCategories: 'name',
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const db = new AppDB()
