import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { deleteArchived, restoreArchived } from '../data/repo'
import type { ArchivedList } from '../data/types'
import EmptyState from '../components/EmptyState'
import { formatLongDate } from '../lib/dates'
import { formatQuantity } from '../lib/units'

function ArchiveEntry({ entry, categoryName }: { entry: ArchivedList; categoryName: (id: string) => string }) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState('')
  const checked = entry.items.filter((i) => i.checked).length

  const byCategory = new Map<string, typeof entry.items>()
  for (const i of entry.items) byCategory.set(i.categoryId, [...(byCategory.get(i.categoryId) ?? []), i])

  return (
    <li className="card overflow-hidden">
      <button className="flex min-h-16 w-full items-center justify-between gap-2 px-4 py-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <span className="block font-semibold">Einkauf vom {formatLongDate(entry.closedAt)}</span>
          <span className="muted text-sm">
            {entry.items.length} Artikel · {checked} abgehakt
          </span>
        </span>
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          {[...byCategory.entries()].map(([catId, items]) => (
            <div key={catId}>
              <h3 className="muted mb-1 text-xs font-semibold tracking-wide uppercase">{categoryName(catId)}</h3>
              <ul>
                {items.map((i) => (
                  <li key={i.id} className={`flex gap-2 py-0.5 ${i.checked ? 'muted' : ''}`}>
                    <span aria-hidden>{i.checked ? '✓' : '○'}</span>
                    <span className={i.checked ? 'line-through' : ''}>
                      {i.name}
                      {(i.qty !== undefined || i.unit) && <span className="muted ml-2 text-sm">{i.qty !== undefined ? formatQuantity(i.qty, i.unit) : i.unit}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="btn"
              onClick={async () => {
                const n = await restoreArchived(entry.id)
                setMsg(`${n} Artikel zur Einkaufsliste hinzugefügt.`)
              }}
            >
              Erneut verwenden
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true)
                await deleteArchived(entry.id)
              }}
            >
              {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
            </button>
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>
      )}
    </li>
  )
}

export default function ArchivePage() {
  const archive = useLiveQuery(() => db.archive.orderBy('closedAt').reverse().toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  if (!archive || !categories) return null
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Sonstiges'

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Archiv</h1>
        <Link to="/liste" className="btn">Zur Liste</Link>
      </div>
      {archive.length === 0 ? (
        <EmptyState icon="🗂️" title="Noch keine abgeschlossenen Einkäufe" hint="Wenn du auf der Einkaufsliste «Einkauf abschliessen» wählst, landet die Liste hier mit Datum." />
      ) : (
        <ul className="flex flex-col gap-2">
          {archive.map((e) => (
            <ArchiveEntry key={e.id} entry={e} categoryName={categoryName} />
          ))}
        </ul>
      )}
    </div>
  )
}
