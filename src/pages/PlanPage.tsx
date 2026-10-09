import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { assignDish, moveEntry, removePlanEntry, setPlanServings } from '../data/repo'
import { SLOT_LABELS, type Dish, type PlanEntry, type Slot } from '../data/types'
import Sheet from '../components/Sheet'
import EmptyState from '../components/EmptyState'
import { addDays, dayParts, formatDay, formatRange, isoWeek, startOfWeek, todayISO, weekDays } from '../lib/dates'

const SLOTS: Slot[] = ['lunch', 'dinner']
const SLOT_SHORT: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' }
const TRAY_ID = 'tray'

type DragData = { kind: 'dish'; dishId: string; label: string } | { kind: 'entry'; label: string }

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

function DishTile({ dish }: { dish: Dish }) {
  const data: DragData = { kind: 'dish', dishId: dish.id, label: dish.name }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `dish:${dish.id}`, data })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="card min-h-12 touch-manipulation select-none px-2.5 py-2 text-left text-sm leading-tight font-medium"
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
      title={dish.name}
    >
      <span className="line-clamp-2">{dish.name}</span>
    </button>
  )
}

function Tray({ dishes, draggingEntry }: { dishes: Dish[]; draggingEntry: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID })
  const [q, setQ] = useState('')
  const list = dishes.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <section
      ref={setNodeRef}
      aria-label="Menüs"
      className="card flex max-h-[30%] min-h-28 shrink-0 flex-col overflow-hidden"
      style={isOver && draggingEntry ? { outline: '2px dashed #dc2626' } : undefined}
    >
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <input
          className="input !min-h-10 py-1"
          type="search"
          placeholder={`Menüs durchsuchen (${dishes.length})…`}
          aria-label="Menüs durchsuchen"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="overflow-y-auto px-2 pb-2">
        {draggingEntry ? (
          <p className="muted py-4 text-center text-sm">Hierher ziehen, um den Eintrag zu entfernen</p>
        ) : dishes.length === 0 ? (
          <div className="py-3 text-center text-sm">
            <p className="muted mb-2">Noch keine Menüs vorhanden.</p>
            <Link to="/menus" className="btn btn-primary">Menüs anlegen</Link>
          </div>
        ) : list.length === 0 ? (
          <p className="muted py-4 text-center text-sm">Keine Treffer.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {list.map((d) => (
              <DishTile key={d.id} dish={d} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EntryChip({ entry, dish, onOpen }: { entry: PlanEntry; dish?: Dish; onOpen: () => void }) {
  const data: DragData = { kind: 'entry', label: dish?.name ?? 'Eintrag' }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id, data })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="min-h-12 w-full touch-manipulation select-none rounded-xl px-2 py-1.5 text-left"
      style={{ background: 'var(--accent-soft)', opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="line-clamp-2 text-sm leading-tight font-medium">{dish?.name ?? '(gelöscht)'}</span>
      <span className="muted text-[11px]">{entry.servings} Port.</span>
    </button>
  )
}

function SlotCell({ date, slot, entry, dish, onAdd, onOpen }: { date: string; slot: Slot; entry?: PlanEntry; dish?: Dish; onAdd: () => void; onOpen: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}|${slot}` })
  return (
    <div ref={setNodeRef} className="flex flex-col rounded-xl p-0.5" style={isOver ? { outline: '2px dashed var(--accent)' } : undefined}>
      <div className="muted hidden px-1 text-[11px] lg:block">{SLOT_SHORT[slot]}</div>
      {entry ? (
        <EntryChip entry={entry} dish={dish} onOpen={onOpen} />
      ) : (
        <button
          className="btn min-h-12 w-full flex-1 border-dashed px-1 text-lg font-normal muted"
          onClick={onAdd}
          aria-label={`${SLOT_LABELS[slot]} hinzufügen`}
        >
          +
        </button>
      )}
    </div>
  )
}

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const [adding, setAdding] = useState<{ date: string; slot: Slot } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<DragData | null>(null)
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const today = todayISO()

  const entries = useLiveQuery(() => db.plan.where('date').between(days[0], days[6], true, true).toArray(), [weekStart])
  const dishes = useLiveQuery(() => db.dishes.orderBy('name').toArray(), [])
  const dishMap = useMemo(() => new Map((dishes ?? []).map((d) => [d.id, d])), [dishes])
  const open = entries?.find((e) => e.id === openId)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragData) ?? null)
  }

  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as DragData | undefined
    setDragging(null)
    if (!e.over || !data) return
    if (e.over.id === TRAY_ID) {
      if (data.kind === 'entry') removePlanEntry(String(e.active.id))
      return
    }
    const [date, slot] = String(e.over.id).split('|')
    if (data.kind === 'dish') assignDish(date, slot as Slot, data.dishId)
    else moveEntry(String(e.active.id), date, slot as Slot)
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <button className="btn btn-icon" aria-label="Vorherige Woche" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <div className="flex-1 text-center leading-tight">
          <h1 className="text-lg font-bold">KW {isoWeek(weekStart)}</h1>
          <p className="muted text-xs whitespace-nowrap">{formatRange(days[0], days[6])}</p>
        </div>
        <button className="chip" onClick={() => setWeekStart(startOfWeek(todayISO()))}>Heute</button>
        <Link to={`/plan/druck?from=${days[0]}&to=${days[6]}`} className="chip !px-2.5" aria-label="Wochenplan drucken" title="Drucken">🖨️</Link>
        <button className="btn btn-icon" aria-label="Nächste Woche" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <Tray dishes={dishes ?? []} draggingEntry={dragging?.kind === 'entry'} />

        <div className="muted grid shrink-0 grid-cols-[3.25rem_1fr_1fr] gap-1 px-1 text-center text-[11px] lg:hidden" aria-hidden>
          <span />
          <span>{SLOT_SHORT.lunch}</span>
          <span>{SLOT_SHORT.dinner}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-1.5 pb-2 lg:grid-cols-7 lg:items-start">
            {days.map((d) => {
              const p = dayParts(d)
              return (
                <section
                  key={d}
                  className="card grid grid-cols-[3.25rem_1fr_1fr] gap-1 p-1 lg:grid-cols-1"
                  style={d === today ? { borderColor: 'var(--accent)', borderWidth: 2 } : undefined}
                >
                  <h2 className="flex flex-col justify-center px-1 leading-tight lg:flex-row lg:items-baseline lg:gap-2">
                    <span className="text-sm font-semibold">{p.weekday}</span>
                    <span className="muted text-xs">{p.date}</span>
                  </h2>
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
              )
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="card px-3 py-2 text-sm font-medium shadow-xl" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
              {dragging.label}
            </div>
          )}
        </DragOverlay>
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
