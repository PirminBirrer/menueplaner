export type Slot = 'lunch' | 'dinner'

export interface Ingredient {
  id: string
  qty?: number
  unit?: string
  name: string
}

export interface Dish {
  id: string
  name: string
  tags: string[]
  notes?: string
  servings?: number
  steps?: string
  ingredients: Ingredient[]
  updatedAt: number
}

export interface PlanEntry {
  id: string
  date: string // YYYY-MM-DD
  slot: Slot
  dishId: string
  servings: number
  updatedAt: number
}

export interface ShopItem {
  id: string
  name: string
  qty?: number
  unit?: string
  categoryId: string
  checked: boolean
  source: 'plan' | 'manual'
  /** Stabiler Schlüssel für aus dem Plan erzeugte Einträge (Zutat|Basiseinheit). */
  planKey?: string
  /** Vom Benutzer bearbeitet: Menge wird beim erneuten Generieren nicht überschrieben. */
  edited?: boolean
  /** «Habe ich schon»: ausgeblendet, wird beim erneuten Generieren nicht wieder hinzugefügt. */
  dismissed?: boolean
  updatedAt: number
}

/** Abgeschlossener Einkauf: Momentaufnahme der Liste zum Zeitpunkt des Abschlusses. */
export interface ArchivedList {
  id: string
  closedAt: number
  items: ShopItem[]
}

export interface Category {
  id: string
  name: string
  sortOrder: number
}

export interface IngredientCategory {
  name: string // normalisierter Zutatname
  categoryId: string
}

export const SLOT_LABELS: Record<Slot, string> = {
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
}
