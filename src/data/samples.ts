import type { Dish } from './types'

type Sample = Omit<Dish, 'id' | 'updatedAt'>

export const SAMPLE_DISHES: Sample[] = [
  {
    name: 'Spaghetti Bolognese',
    tags: ['Pasta', 'Familie'],
    servings: 4,
    steps: 'Zwiebel und Knoblauch anbraten, Hackfleisch beigeben, mit Tomaten ablöschen und 30 Minuten köcheln. Spaghetti kochen.',
    ingredients: [
      { id: '', qty: 400, unit: 'g', name: 'Spaghetti' },
      { id: '', qty: 400, unit: 'g', name: 'Hackfleisch' },
      { id: '', qty: 1, name: 'Zwiebel' },
      { id: '', qty: 1, unit: 'Dose', name: 'Pelati' },
    ],
  },
  {
    name: 'Gemüsecurry',
    tags: ['vegetarisch', 'schnell'],
    servings: 2,
    ingredients: [
      { id: '', qty: 200, unit: 'g', name: 'Reis' },
      { id: '', qty: 2, unit: 'dl', name: 'Kokosmilch' },
      { id: '', qty: 300, unit: 'g', name: 'Zucchini' },
    ],
  },
  { name: 'Pizza vom Beck', tags: ['schnell'], ingredients: [] },
]
