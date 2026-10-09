import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { assignDish, moveEntry, removePlanEntry, setPlanServings } from '../data/repo'
import { SLOT_LABELS, type Dish, type PlanEntry, type Slot } from '../data/types'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import { addDays, formatDay, formatRange, isoWeek, startOfWeek, todayISO, weekDays } from '../lib/dates'

const SLOTS: Slot[] = ['lunch', 'dinner']

function DishPicker({ onPick, onClose }: { onPick: (d: Dish) => void; onClose: () => void }) {
  const dishes = useLiveQuery(() => db.dishes.orderBy('name').toArray(), [])
  const [q, setQ] = useState('')
  const list = (dishes ?? []).filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Sheet title="Menü wählen" onClose={onClose}>
      {dishes && dishes.length === 0 ? (
        <EmptyState icon="🍽️" title="Keine Menüs vorhanden" hint="Lege zuerst Menüs in deiner Sammlung an.">
          <Link to="/menus" className="btn btn-primary">Zu den Menüs</Link>
        </EmptyState>
      ) : (
        <>
          <input className="input mb-3" type="search" autoFocus placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="flex flex-col gap-2">
            {list.map((d) => (
              <li key={d.id}>
                <button className="card min-h-14 w-full px-4 py-3 text-left font-medium" onClick={() => onPick(d)}>
                  {d.name}
                  {d.tags.length > 0 && <span className="muted ml-2 text-xs">{d.tags.join(' · ')}</span>}
                </button>
              </li>
            ))}
            {list.length === 0 && <p className="muted py-6 text-center">Keine Treffer.</p>}
          </ul>
        </>
      )}
    </Sheet>
  )
}

function EntrySheet({ entry, dish, week, onClose }: { entry: PlanEntry; dish?: Dish; week: string[]; onClose: () => void }) {
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState(`${entry.date}|${entry.slot}`)

  if (picking) {
    return (
      <DishPicker
        onClose={() => setPicking(false)}
        onPick={async (d) => {
          await assignDish(entry.date, entry.slot, d.id)
          onClose()
        }}
      />
    )
  }
  return (
    <Sheet title={dish?.name ?? 'Eintrag'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Portionen</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-icon" aria-label="Weniger" onClick={() => setPlanServings(entry.id, entry.servings - 1)}>−</button>
            <span className="w-8 text-center text-lg font-semibold" aria-live="polite">{entry.servings}</span>
            <button className="btn btn-icon" aria-label="Mehr" onClick={() => setPlanServings(entry.id, entry.servings + 1)}>+</button>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Verschieben / tauschen nach
          <div className="flex gap-2">
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {week.flatMap((d) =>
                SLOTS.map((s) => (
                  <option key={`${d}|${s}`} value={`${d}|${s}`}>
                    {formatDay(d)} · {SLOT_LABELS[s]}
                  </option>
                )),
              )}
            </select>
            <button
              className="btn"
              onClick={async () => {
                const [d, s] = target.split('|')
                await moveEntry(entry.id, d, s as Slot)
                onClose()
              }}
            >
              OK
            </button>
          </div>
        </label>

        <button className="btn" onClick={() => setPicking(true)}>Anderes Menü wählen</button>
        <button
          className="btn btn-danger"
          onClick={async () => {
            await removePlanEntry(entry.id)
            onClose()
          }}
        >
          Aus Plan entfernen
        </button>
      </div>
    </Sheet>
  )
}

function EntryChip({ entry, dish, onOpen }: { entry: PlanEntry; dish?: Dish; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.id })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="w-full touch-manipulation select-none rounded-xl px-3 py-2 text-left"
      style={{
        background: 'var(--accent-soft)',
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: 'relative',
      }}
    >
      <span className="block font-medium leading-tight">{dish?.name ?? '(gelöscht)'}</span>
      <span className="muted text-xs">{entry.servings} Portionen</span>
    </button>
  )
}

function SlotCell({ date, slot, entry, dish, onAdd, onOpen }: { date: string; slot: Slot; entry?: PlanEntry; dish?: Dish; onAdd: () => void; onOpen: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}|${slot}` })
  return (
    <div ref={setNodeRef} className="rounded-xl p-1" style={isOver ? { outline: '2px dashed var(--accent)' } : undefined}>
      <div className="muted px-1 pb-0.5 text-xs">{SLOT_LABELS[slot]}</div>
      {entry ? (
        <EntryChip entry={entry} dish={dish} onOpen={onOpen} />
      ) : (
        <button className="btn w-full border-dashed text-sm font-normal muted" onClick={onAdd}>+ Hinzufügen</button>
      )}
    </div>
  )
}

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const [adding, setAdding] = useState<{ date: string; slot: Slot } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const today = todayISO()

  const entries = useLiveQuery(() => db.plan.where('date').between(days[0], days[6], true, true).toArray(), [weekStart])
  const dishes = useLiveQuery(() => db.dishes.toArray(), [])
  const dishMap = useMemo(() => new Map((dishes ?? []).map((d) => [d.id, d])), [dishes])
  const open = entries?.find((e) => e.id === openId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return
    const [date, slot] = String(e.over.id).split('|')
    moveEntry(String(e.active.id), date, slot as Slot)
  }

  const hasDishes = (dishes?.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex items-center gap-2">
        <button className="btn btn-icon" aria-label="Vorherige Woche" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold">KW {isoWeek(weekStart)}</h1>
          <p className="muted text-sm">{formatRange(days[0], days[6])}</p>
        </div>
        <button className="btn btn-icon" aria-label="Nächste Woche" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
      </div>
      <div className="mb-3 flex justify-center">
        <button className="chip" onClick={() => setWeekStart(startOfWeek(todayISO()))}>Heute</button>
      </div>

      {dishes && !hasDishes && (
        <div className="card mb-3">
          <EmptyState icon="📅" title="Noch nichts zu planen" hint="Lege zuerst ein paar Menüs an, dann kannst du sie hier den Tagen zuweisen.">
            <Link to="/menus" className="btn btn-primary">Menüs anlegen</Link>
          </EmptyState>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((d) => (
            <section key={d} className="card p-2" style={d === today ? { borderColor: 'var(--accent)', borderWidth: 2 } : undefined}>
              <h2 className="px-1 pb-1 text-sm font-semibold">{formatDay(d)}</h2>
              {SLOTS.map((slot) => {
                const entry = entries?.find((e) => e.date === d && e.slot === slot)
                return (
                  <SlotCell
                    key={slot}
                    date={d}
                    slot={slot}
                    entry={entry}
                    dish={entry && dishMap.get(entry.dishId)}
                    onAdd={() => setAdding({ date: d, slot })}
                    onOpen={() => entry && setOpenId(entry.id)}
                  />
                )
              })}
            </section>
          ))}
        </div>
      </DndContext>

      {adding && (
        <DishPicker
          onClose={() => setAdding(null)}
          onPick={async (dish) => {
            await assignDish(adding.date, adding.slot, dish.id)
            setAdding(null)
          }}
        />
      )}
      {open && <EntrySheet entry={open} dish={dishMap.get(open.dishId)} week={days} onClose={() => setOpenId(null)} />}
    </div>
  )
}
