import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { deleteDish, newId, saveDish } from '../data/repo'
import type { Dish } from '../data/types'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import UnitSelect, { DEFAULT_UNIT } from '../components/UnitSelect'
import { SAMPLE_DISHES } from '../data/samples'

interface Row {
  key: string
  qty: string
  unit: string // '' = Anzahl
  name: string
}

const toRows = (d?: Dish): Row[] =>
  (d?.ingredients ?? []).map((i) => ({
    key: i.id || newId(),
    qty: i.qty !== undefined ? String(i.qty).replace('.', ',') : '',
    unit: i.unit ?? '',
    name: i.name,
  }))

function DishForm({ dish, onClose }: { dish?: Dish; onClose: () => void }) {
  const [name, setName] = useState(dish?.name ?? '')
  const [servings, setServings] = useState(dish?.servings?.toString() ?? '')
  const [tags, setTags] = useState(dish?.tags.join(', ') ?? '')
  const [rows, setRows] = useState<Row[]>(() => toRows(dish))
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [steps, setSteps] = useState(dish?.steps ?? '')
  const [notes, setNotes] = useState(dish?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hasRecipe = !!(dish?.ingredients.length || dish?.steps || dish?.servings)

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function addRow() {
    const key = newId()
    setRows((rs) => [...rs, { key, qty: '', unit: DEFAULT_UNIT, name: '' }])
    setFocusKey(key)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const s = Number(servings.replace(',', '.'))
    await saveDish({
      id: dish?.id,
      name: name.trim(),
      servings: s > 0 ? s : undefined,
      tags: [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))],
      ingredients: rows
        .filter((r) => r.name.trim())
        .map((r) => {
          const q = Number(r.qty.replace(',', '.'))
          const qty = r.qty.trim() && Number.isFinite(q) && q > 0 ? q : undefined
          return { id: r.key, qty, unit: qty !== undefined && r.unit ? r.unit : undefined, name: r.name.trim() }
        }),
      steps: steps.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <Sheet title={dish ? 'Menü bearbeiten' : 'Neues Menü'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Spaghetti Bolognese" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tags (mit Komma getrennt)
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vegetarisch, schnell" />
        </label>

        <details open={hasRecipe} className="card p-3">
          <summary className="cursor-pointer font-semibold">Rezept (optional)</summary>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Portionen
              <input className="input" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="z. B. 4" />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Zutaten</legend>
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[5rem_8rem_1fr_auto]">
                  <input
                    className="input col-span-3 sm:order-3 sm:col-span-1"
                    placeholder="Was? z. B. Milch"
                    aria-label="Zutat"
                    autoFocus={r.key === focusKey}
                    value={r.name}
                    onChange={(e) => patchRow(r.key, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (r.name.trim()) addRow()
                      }
                    }}
                  />
                  <input
                    className="input sm:order-1"
                    inputMode="decimal"
                    placeholder="Menge"
                    aria-label="Menge"
                    value={r.qty}
                    onChange={(e) => patchRow(r.key, { qty: e.target.value })}
                  />
                  <UnitSelect className="sm:order-2" value={r.unit} onChange={(unit) => patchRow(r.key, { unit })} />
                  <button
                    type="button"
                    className="btn btn-icon btn-danger sm:order-4"
                    aria-label="Zutat entfernen"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn self-start" onClick={addRow}>
                + Zutat
              </button>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Zubereitung
              <textarea className="input min-h-28" value={steps} onChange={(e) => setSteps(e.target.value)} />
            </label>
          </div>
        </details>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Notizen
          <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="flex gap-2">
          {dish && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true)
                await deleteDish(dish.id)
                onClose()
              }}
            >
              {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
            </button>
          )}
          <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none">
            Speichern
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export default function MenusPage() {
  const dishes = useLiveQuery(() => db.dishes.orderBy('name').toArray(), [])
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [editing, setEditing] = useState<Dish | 'new' | null>(null)
  const [params, setParams] = useSearchParams()

  // Aus dem Plan verlinkt: /menus?edit=<id> öffnet direkt das Bearbeiten-Formular.
  useEffect(() => {
    const id = params.get('edit')
    if (!id || !dishes) return
    const dish = dishes.find((d) => d.id === id)
    if (dish) setEditing(dish)
    setParams({}, { replace: true })
  }, [params, dishes, setParams])

  const allTags = useMemo(() => [...new Set((dishes ?? []).flatMap((d) => d.tags))].sort(), [dishes])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (dishes ?? []).filter(
      (d) =>
        (!q || d.name.toLowerCase().includes(q) || d.ingredients.some((i) => i.name.toLowerCase().includes(q))) &&
        activeTags.every((t) => d.tags.includes(t)),
    )
  }, [dishes, query, activeTags])

  if (!dishes) return null

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <h1 className="mb-3 text-2xl font-bold">Menüs</h1>

      {dishes.length === 0 ? (
        <EmptyState icon="🍽️" title="Noch keine Menüs" hint="Lege dein erstes Menü an. Nur der Name ist Pflicht, das Rezept kannst du später ergänzen.">
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Menü hinzufügen</button>
          <button className="btn" onClick={() => SAMPLE_DISHES.forEach((d) => saveDish({ ...d, ingredients: d.ingredients.map((i) => ({ ...i, id: newId() })) }))}>
            Beispiele laden
          </button>
        </EmptyState>
      ) : (
        <>
          <input className="input mb-3" type="search" placeholder="Menü oder Zutat suchen…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {allTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {allTags.map((t) => (
                <button
                  key={t}
                  className="chip"
                  aria-pressed={activeTags.includes(t)}
                  onClick={() => setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 && <p className="muted py-8 text-center">Keine Treffer.</p>}
          <ul className="flex flex-col gap-2">
            {filtered.map((d) => (
              <li key={d.id}>
                <button className="card w-full p-4 text-left" onClick={() => setEditing(d)}>
                  <div className="font-semibold">{d.name}</div>
                  <div className="muted mt-0.5 text-sm">
                    {d.ingredients.length > 0
                      ? `${d.ingredients.length} Zutaten${d.servings ? ` · ${d.servings} Portionen` : ''}`
                      : 'Ohne Rezept'}
                  </div>
                  {d.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.tags.map((t) => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--accent-soft)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        className="btn btn-primary fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full text-2xl shadow-lg md:right-8 md:bottom-8"
        onClick={() => setEditing('new')}
        aria-label="Menü hinzufügen"
      >
        +
      </button>

      {editing && <DishForm dish={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
