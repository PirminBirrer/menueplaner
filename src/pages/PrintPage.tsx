import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import type { Slot } from '../data/types'
import { addDays, fromISO, isoWeek, startOfWeek, todayISO } from '../lib/dates'
import { tagColor, tagTint } from '../lib/tags'

const SLOTS: { slot: Slot; label: string; short: string }[] = [
  { slot: 'lunch', label: 'Mittagessen', short: 'Mittag' },
  { slot: 'dinner', label: 'Abendessen', short: 'Abend' },
]
const MAX_DAYS = 8 * 7

const longDate = (iso: string, opts: Intl.DateTimeFormatOptions) => fromISO(iso).toLocaleDateString('de-CH', opts)

function rangeDays(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < MAX_DAYS; d = addDays(d, 1)) out.push(d)
  return out
}

export default function PrintPage() {
  const [params] = useSearchParams()
  const thisWeek = startOfWeek(todayISO())
  const [from, setFrom] = useState(params.get('from') ?? thisWeek)
  const [to, setTo] = useState(params.get('to') ?? addDays(thisWeek, 6))
  const [showServings, setShowServings] = useState(true)
  const [landscape, setLandscape] = useState(() => {
    try {
      return localStorage.getItem('print-orientation') !== 'portrait'
    } catch {
      return true
    }
  })
  const chooseOrientation = (l: boolean) => {
    setLandscape(l)
    try {
      localStorage.setItem('print-orientation', l ? 'landscape' : 'portrait')
    } catch {
      /* Speichern ist optional */
    }
  }

  const valid = !!from && !!to && from <= to
  const days = useMemo(() => (valid ? rangeDays(from, to) : []), [from, to, valid])
  const entries = useLiveQuery(() => (valid ? db.plan.where('date').between(from, to, true, true).toArray() : []), [from, to, valid])
  const dishes = useLiveQuery(() => db.dishes.toArray(), [])
  const dishMap = useMemo(() => new Map((dishes ?? []).map((d) => [d.id, d])), [dishes])

  const weeks = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const d of days) {
      const w = startOfWeek(d)
      map.set(w, [...(map.get(w) ?? []), d])
    }
    return [...map.entries()]
  }, [days])

  const cellFor = (d: string, slot: Slot) => {
    const entry = entries?.find((x) => x.date === d && x.slot === slot)
    return { entry, dish: entry && dishMap.get(entry.dishId) }
  }

  const presets = [
    { label: 'Diese Woche', from: thisWeek, to: addDays(thisWeek, 6) },
    { label: 'Nächste Woche', from: addDays(thisWeek, 7), to: addDays(thisWeek, 13) },
    { label: '2 Wochen', from: thisWeek, to: addDays(thisWeek, 13) },
  ]
  const planned = entries?.length ?? 0

  return (
    <div className={`print-root mx-auto ${landscape ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <div className="no-print mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Wochenplan drucken</h1>
          <Link to="/plan" className="btn">Zurück</Link>
        </div>
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
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Seitenformat">
          <span className="text-sm font-medium">Format:</span>
          <button className="chip" aria-pressed={landscape} onClick={() => chooseOrientation(true)}>↔ Querformat</button>
          <button className="chip" aria-pressed={!landscape} onClick={() => chooseOrientation(false)}>↕ Hochformat</button>
        </div>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={showServings} onChange={(e) => setShowServings(e.target.checked)} />
          Portionen anzeigen
        </label>
        {!valid && <p className="text-sm text-amber-600">Bitte einen gültigen Zeitraum wählen (Von vor Bis).</p>}
        {valid && days.length >= MAX_DAYS && <p className="text-sm text-amber-600">Es werden höchstens 8 Wochen gedruckt.</p>}
        {valid && entries && planned === 0 && <p className="muted text-sm">In diesem Zeitraum ist noch nichts geplant. Der Ausdruck enthält leere Felder zum Ausfüllen.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={!valid} onClick={() => window.print()}>🖨️ Drucken</button>
          <span className="muted text-sm">Für ein PDF im Druckdialog «Als PDF speichern» wählen.</span>
        </div>
      </div>

      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`}</style>
      <div className={landscape ? 'overflow-x-auto' : undefined}>
      <div className={`print-sheet ${landscape ? 'is-land' : ''}`}>
        <header className="print-header">
          <h2>Wochenplan</h2>
          {valid && (
            <p>
              {longDate(from, { day: 'numeric', month: 'long' })} – {longDate(to, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </header>

        {weeks.map(([weekStart, weekDaysList]) =>
          landscape ? (
            <section key={weekStart} className="print-week print-land">
              <h3>
                KW {isoWeek(weekStart)}
                <span>
                  {longDate(weekDaysList[0], { day: 'numeric', month: 'long' })} – {longDate(weekDaysList[weekDaysList.length - 1], { day: 'numeric', month: 'long' })}
                </span>
              </h3>
              <div className="land-grid" style={{ '--n': weekDaysList.length } as CSSProperties}>
                <span className="land-corner" />
                {weekDaysList.map((d) => (
                  <div key={d} className="land-head">
                    <strong>{longDate(d, { weekday: 'long' })}</strong>
                    <span>{longDate(d, { day: 'numeric', month: 'numeric' })}</span>
                  </div>
                ))}
                {SLOTS.map((s) => (
                  <Fragment key={s.slot}>
                    <div className="land-label">{s.short}</div>
                    {weekDaysList.map((d) => {
                      const { entry, dish } = cellFor(d, s.slot)
                      const first = dish?.tags[0]
                      const weekend = [0, 6].includes(fromISO(d).getDay())
                      return (
                        <div
                          key={d}
                          className={`land-cell ${weekend && !entry ? 'print-weekend' : ''}`}
                          style={entry ? { borderTopColor: first ? tagColor(first) : 'var(--p-accent)', background: first ? tagTint(first) : 'var(--p-soft)' } : undefined}
                        >
                          {entry && (
                            <>
                              <span className="print-dish land-dish">{dish?.name ?? '(gelöscht)'}</span>
                              {showServings && <span className="print-servings">{entry.servings} Portionen</span>}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </section>
          ) : (
          <section key={weekStart} className="print-week">
            <h3>
              KW {isoWeek(weekStart)}
              <span>
                {longDate(weekDaysList[0], { day: 'numeric', month: 'long' })} – {longDate(weekDaysList[weekDaysList.length - 1], { day: 'numeric', month: 'long' })}
              </span>
            </h3>
            <div className="print-grid print-grid-head">
              <span />
              {SLOTS.map((s) => (
                <span key={s.slot}>{s.label}</span>
              ))}
            </div>
            {weekDaysList.map((d) => {
              const weekend = [0, 6].includes(fromISO(d).getDay())
              return (
                <div key={d} className={`print-grid print-row ${weekend ? 'print-weekend' : ''}`}>
                  <div className="print-day">
                    <strong>{longDate(d, { weekday: 'long' })}</strong>
                    <span>{longDate(d, { day: 'numeric', month: 'numeric' })}</span>
                  </div>
                  {SLOTS.map((s) => {
                    const e = entries?.find((x) => x.date === d && x.slot === s.slot)
                    const dish = e && dishMap.get(e.dishId)
                    return (
                      <div key={s.slot} className="print-cell">
                        {e && (
                          <>
                            <span className="print-dish">{dish?.name ?? '(gelöscht)'}</span>
                            {showServings && <span className="print-servings">{e.servings} Portionen</span>}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </section>
        )
        )}

        <footer className="print-footer">Menüplaner · gedruckt am {longDate(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' })}</footer>
      </div>
      </div>
    </div>
  )
}
