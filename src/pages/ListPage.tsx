import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import {
  addManualItem,
  clearChecked,
  deleteItem,
  generateShoppingList,
  setItemCategory,
  toggleItem,
  updateItem,
} from '../data/repo'
import type { Category, ShopItem } from '../data/types'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import UnitSelect from '../components/UnitSelect'
import { addDays, startOfWeek, todayISO } from '../lib/dates'
import { formatNumber, formatQuantity, parseIngredientLine, toBase } from '../lib/units'

function GenerateSheet({ onClose }: { onClose: () => void }) {
  const today = todayISO()
  const thisWeek = startOfWeek(today)
  const [from, setFrom] = useState(thisWeek)
  const [to, setTo] = useState(addDays(thisWeek, 6))
  const [msg, setMsg] = useState('')

  const presets = [
    { label: 'Diese Woche', from: thisWeek, to: addDays(thisWeek, 6) },
    { label: 'Nächste Woche', from: addDays(thisWeek, 7), to: addDays(thisWeek, 13) },
    { label: 'Ab heute bis Sonntag', from: today, to: addDays(thisWeek, 6) },
    { label: 'Heute + 2 Tage', from: today, to: addDays(today, 2) },
  ]

  async function run() {
    const r = await generateShoppingList(from, to)
    if (r.total === 0) setMsg('Im gewählten Zeitraum sind keine Menüs geplant.')
    else onClose()
  }

  return (
    <Sheet title="Aus Plan erzeugen" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.label} className="chip" aria-pressed={from === p.from && to === p.to} onClick={() => { setFrom(p.from); setTo(p.to) }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">Von<input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Bis<input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <p className="muted text-sm">Manuelle Artikel und abgehakte Einträge bleiben erhalten.</p>
        {msg && <p className="text-sm text-amber-600">{msg}</p>}
        <button className="btn btn-primary" disabled={!from || !to || to < from} onClick={run}>Liste erzeugen</button>
      </div>
    </Sheet>
  )
}

function ItemSheet({ item, categories, onClose }: { item: ShopItem; categories: Category[]; onClose: () => void }) {
  const [name, setName] = useState(item.name)
  const [qty, setQty] = useState(item.qty !== undefined ? String(item.qty).replace('.', ',') : '')
  const [unit, setUnit] = useState(item.unit ?? '')
  const [cat, setCat] = useState(item.categoryId)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const q = qty.trim() ? Number(qty.replace(',', '.')) : undefined
    const base = toBase(Number.isFinite(q) ? q : undefined, unit)
    await updateItem(item, { name: name.trim(), qty: base.qty, unit: base.unit || undefined })
    if (cat !== item.categoryId) await setItemCategory({ ...item, name: name.trim() }, cat)
    onClose()
  }

  return (
    <Sheet title="Artikel bearbeiten" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">Name<input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">Menge<input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-sm font-medium">Einheit<UnitSelect value={unit} onChange={setUnit} /></label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kategorie (wird gemerkt)
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn btn-danger" onClick={async () => { await deleteItem(item.id); onClose() }}>Löschen</button>
          <button type="submit" className="btn btn-primary flex-1">Speichern</button>
        </div>
      </form>
    </Sheet>
  )
}

export default function ListPage() {
  const items = useLiveQuery(() => db.shop.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [])
  const [text, setText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<ShopItem | null>(null)

  const groups = useMemo(() => {
    if (!items || !categories) return []
    return categories
      .map((c) => ({
        category: c,
        items: items
          .filter((i) => i.categoryId === c.id)
          .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'de')),
      }))
      .filter((g) => g.items.length > 0)
  }, [items, categories])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const p = parseIngredientLine(text)
    const base = toBase(p.qty, p.unit)
    await addManualItem(p.name, base.qty, base.unit || undefined)
    setText('')
  }

  if (!items || !categories) return null
  const checkedCount = items.filter((i) => i.checked).length

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Einkauf</h1>
        <button className="btn btn-primary" onClick={() => setGenerating(true)}>Aus Plan erzeugen</button>
      </div>

      <form onSubmit={add} className="mb-4 flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Artikel hinzufügen, z. B. 2 l Milch" aria-label="Artikel hinzufügen" enterKeyHint="done" />
        <button className="btn btn-primary btn-icon" aria-label="Hinzufügen" type="submit">+</button>
      </form>

      {items.length === 0 ? (
        <EmptyState icon="🛒" title="Die Liste ist leer" hint="Tippe oben einen Artikel ein oder erzeuge die Liste aus deinem Wochenplan." />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.category.id}>
              <h2 className="muted mb-1 px-1 text-sm font-semibold tracking-wide uppercase">{g.category.name}</h2>
              <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-center" style={{ borderColor: 'var(--border)' }}>
                    <button
                      className="flex min-h-14 w-14 shrink-0 items-center justify-center"
                      onClick={() => toggleItem(i)}
                      role="checkbox"
                      aria-checked={i.checked}
                      aria-label={`${i.name} abhaken`}
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm text-white"
                        style={{ borderColor: 'var(--accent)', background: i.checked ? 'var(--accent)' : 'transparent' }}
                      >
                        {i.checked ? '✓' : ''}
                      </span>
                    </button>
                    <button className={`min-h-14 flex-1 py-2 pr-4 text-left ${i.checked ? 'muted line-through' : ''}`} onClick={() => setEditing(i)}>
                      <span className="font-medium">{i.name}</span>
                      {(i.qty !== undefined || i.unit) && (
                        <span className="muted ml-2 text-sm">{i.qty !== undefined ? formatQuantity(i.qty, i.unit) : i.unit}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {checkedCount > 0 && (
            <button className="btn btn-danger self-center" onClick={() => clearChecked()}>
              {formatNumber(checkedCount)} abgehakte entfernen
            </button>
          )}
        </div>
      )}

      {generating && <GenerateSheet onClose={() => setGenerating(false)} />}
      {editing && <ItemSheet item={editing} categories={categories} onClose={() => setEditing(null)} />}
    </div>
  )
}
