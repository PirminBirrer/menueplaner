import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { todayISO, fromISO } from '../lib/dates'
import { formatQuantity } from '../lib/units'

export default function ShoppingPrintPage() {
  const shop = useLiveQuery(() => db.shop.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [])
  const [showChecked, setShowChecked] = useState(false)

  const groups = useMemo(() => {
    if (!shop || !categories) return []
    const items = shop.filter((i) => !i.dismissed && (showChecked || !i.checked))
    return categories
      .map((c) => ({
        category: c,
        items: items
          .filter((i) => i.categoryId === c.id)
          .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'de')),
      }))
      .filter((g) => g.items.length > 0)
  }, [shop, categories, showChecked])

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const dateLabel = fromISO(todayISO()).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="print-root mx-auto max-w-3xl">
      <style>{'@page { size: A4 portrait; margin: 10mm; }'}</style>

      <div className="no-print mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Einkaufsliste drucken</h1>
          <Link to="/liste" className="btn">Zurück</Link>
        </div>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={showChecked} onChange={(e) => setShowChecked(e.target.checked)} />
          Bereits abgehakte Artikel mitdrucken
        </label>
        {shop && total === 0 && <p className="muted text-sm">Die Liste ist leer. Es gibt nichts zu drucken.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={total === 0} onClick={() => window.print()}>🖨️ Drucken</button>
          <span className="muted text-sm">Für ein PDF im Druckdialog «Als PDF speichern» wählen.</span>
        </div>
      </div>

      <div className="print-sheet">
        <header className="print-header">
          <h2>Einkaufsliste</h2>
          <p>
            {dateLabel} · {total} Artikel
          </p>
        </header>

        <div className="sp-cols">
          {groups.map((g) => (
            <section key={g.category.id} className="sp-group">
              <h3>{g.category.name}</h3>
              <ul>
                {g.items.map((i) => (
                  <li key={i.id} className={`sp-row ${i.checked ? 'sp-done' : ''}`}>
                    <span className="sp-box" aria-hidden>{i.checked ? '✓' : ''}</span>
                    <span className="sp-name">{i.name}</span>
                    {(i.qty !== undefined || i.unit) && <span className="sp-qty">{i.qty !== undefined ? formatQuantity(i.qty, i.unit) : i.unit}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="print-footer">Menüplaner · gedruckt am {dateLabel}</footer>
      </div>
    </div>
  )
}
