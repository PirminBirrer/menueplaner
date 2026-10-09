import type { Category } from '../data/types'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'gemuese', name: 'Gemüse & Obst', sortOrder: 1 },
  { id: 'milch', name: 'Milchprodukte', sortOrder: 2 },
  { id: 'fleisch', name: 'Fleisch & Fisch', sortOrder: 3 },
  { id: 'brot', name: 'Brot & Backwaren', sortOrder: 4 },
  { id: 'vorrat', name: 'Vorrat & Konserven', sortOrder: 5 },
  { id: 'getraenke', name: 'Getränke', sortOrder: 6 },
  { id: 'tiefkuehl', name: 'Tiefkühl', sortOrder: 7 },
  { id: 'haushalt', name: 'Haushalt & Drogerie', sortOrder: 8 },
  { id: 'sonstiges', name: 'Sonstiges', sortOrder: 99 },
]

const KEYWORDS: [string, string[]][] = [
  ['gemuese', ['tomate', 'zwiebel', 'knoblauch', 'karotte', 'rüebli', 'salat', 'gurke', 'paprika', 'zucchini', 'kartoffel', 'apfel', 'banane', 'zitrone', 'pilz', 'lauch', 'spinat', 'broccoli', 'brokkoli', 'kürbis', 'petersilie', 'basilikum', 'ingwer', 'peperoni']],
  ['milch', ['milch', 'käse', 'butter', 'joghurt', 'rahm', 'quark', 'mozzarella', 'parmesan', 'ei', 'eier', 'sahne', 'mascarpone']],
  ['fleisch', ['fleisch', 'poulet', 'huhn', 'hack', 'lachs', 'fisch', 'schinken', 'speck', 'wurst', 'rind', 'schwein', 'thon', 'crevetten']],
  ['brot', ['brot', 'brötchen', 'toast', 'mehl', 'zopf']],
  ['vorrat', ['spaghetti', 'pasta', 'nudel', 'reis', 'zucker', 'salz', 'pfeffer', 'öl', 'essig', 'konserve', 'bohne', 'linsen', 'sauce', 'bouillon', 'gewürz', 'couscous']],
  ['getraenke', ['wasser', 'saft', 'wein', 'bier', 'cola', 'tee', 'kaffee']],
  ['tiefkuehl', ['tiefkühl', 'glace', 'pizza']],
  ['haushalt', ['zahnpasta', 'seife', 'shampoo', 'putz', 'spülmittel', 'toilettenpapier', 'küchenpapier', 'waschmittel', 'schwamm', 'müllsack', 'windel']],
]

/** Einfache Vorbelegung, falls die App die Zutat noch nicht kennt. */
export function guessCategory(normalizedName: string): string {
  for (const [id, words] of KEYWORDS) {
    if (words.some((w) => (w.length <= 3 ? normalizedName === w : normalizedName.includes(w)))) return id
  }
  return 'sonstiges'
}
