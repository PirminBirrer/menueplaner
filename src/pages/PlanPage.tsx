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
import { TagDots, TagFilter, useDishFilter } from '../components/DishFilter'
import { tagColor, tagTint } from '../lib/tags'
import { formatNumber } from '../lib/units'
import { addDays, dayParts, formatDay, fromISO, formatRange, isoWeek, startOfWeek, todayISO, weekDays } from '../lib/dates'

const SLOTS: Slot[] = ['lunch', 'dinner']
const SLOT_SHORT: Record<Slot, string> = { lunch: 'Mittag', dinner: 'Abend' }
const SLOT_ICON: Record<Slot, string> = { lunch: '☀️', dinner: '🌙' }
const TRAY_ID = 'tray'

type DragData = { kind: 'dish'; dishId: string; label: string } | { kind: 'entry'; label: string }

function DishPicker({ onPick, onClose }: { onPick: (d: Dish) => void; onClose: () => void }) {
  const dishes = useLiveQuery(() => db.dishes.orderBy('name').toArray(), [])
  const f = useDishFilter(dishes ?? [])
  return (
    <Sheet title="Menü wählen" onClose={onClose}>
      {dishes && dishes.length === 0 ? (
        <EmptyState icon="🍽️" title="Keine Menüs vorhanden" hint="Lege zuerst Menüs in deiner Sammlung an.">
          <Link to="/menus" className="btn btn-primary">Zu den Menüs</Link>
        </EmptyState>
      ) : (
        <>
          <input className="input mb-2" type="search" autoFocus placeholder="Suchen…" value={f.q} onChange={(e) => f.setQ(e.target.value)} />
          <div className="mb-3">
            <TagFilter tags={f.tags} active={f.active} onToggle={f.toggle} onClear={f.clear} />
          </div>
          <ul className="flex flex-col gap-2">
            {f.list.map((d) => (
              <li key={d.id}>
                <button
                  className="card relative flex min-h-14 w-full flex-col justify-center overflow-hidden py-2.5 pr-4 pl-5 text-left"
                  onClick={() => onPick(d)}
                >
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: d.tags[0] ? tagColor(d.tags[0]) : 'var(--border)' }} aria-hidden />
                  <span className="font-semibold">{d.name}</span>
                  <span className="muted flex items-center gap-2 text-xs">
                    <TagDots tags={d.tags} max={3} />
                    {d.ingredients.length === 0 && <span>Ohne Rezept</span>}
                  </span>
                </button>
              </li>
            ))}
            {f.list.length === 0 && (
              <div className="py-6 text-center">
                <p className="muted mb-2">Keine Treffer.</p>
                <button className="btn" onClick={f.clear}>Filter zurücksetzen</button>
              </div>
            )}
          </ul>
        </>
      )}
    </Sheet>
  )
}

function RecipeSheet({ dish, servings, onClose }: { dish: Dish; servings?: number; onClose: () => void }) {
  const base = dish.servings && dish.servings > 0 ? dish.servings : undefined
  const [portions, setPortions] = useState(servings ?? base ?? 2)
  const factor = base ? portions / base : 1
  const hasRecipe = dish.ingredients.length > 0 || !!dish.steps

  return (
    <Sheet title={dish.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {dish.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dish.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: tagTint(t) }}>
                <span className="h-2 w-2 rounded-full" style={{ background: tagColor(t) }} aria-hidden />
                {t}
              </span>
            ))}
          </div>
        )}

        {dish.ingredients.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">Zutaten</h3>
              <div className="flex items-center gap-2" aria-label="Portionen">
                <button className="btn btn-icon !min-h-10 !min-w-10" aria-label="Weniger Portionen" onClick={() => setPortions((p) => Math.max(1, p - 1))}>−</button>
                <span className="min-w-20 text-center text-sm font-medium" aria-live="polite">{portions} Portionen</span>
                <button className="btn btn-icon !min-h-10 !min-w-10" aria-label="Mehr Portionen" onClick={() => setPortions((p) => p + 1)}>+</button>
              </div>
            </div>
            {!base && <p className="muted mb-2 text-xs">Für dieses Rezept sind keine Portionen hinterlegt, die Mengen werden nicht umgerechnet.</p>}
            <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {dish.ingredients.map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-3 px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                  <span>{i.name}</span>
                  <span className="muted shrink-0 text-sm">
                    {i.qty !== undefined ? `${formatNumber(i.qty * factor)}${i.unit ? ` ${i.unit}` : ''}` : i.unit ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {dish.steps && (
          <section>
            <h3 className="mb-1 font-semibold">Zubereitung</h3>
            <p className="whitespace-pre-line leading-relaxed">{dish.steps}</p>
          </section>
        )}

        {dish.notes && (
          <section>
            <h3 className="mb-1 font-semibold">Notizen</h3>
            <p className="muted whitespace-pre-line">{dish.notes}</p>
          </section>
        )}

        {!hasRecipe && !dish.notes && <p className="muted">Für dieses Menü ist noch kein Rezept hinterlegt.</p>}

        <Link to={`/menus?edit=${dish.id}`} className="btn" onClick={onClose}>
          {hasRecipe ? 'Rezept bearbeiten' : 'Rezept ergänzen'}
        </Link>
      </div>
    </Sheet>
  )
}

function EntrySheet({ entry, dish, week, onClose }: { entry: PlanEntry; dish?: Dish; week: string[]; onClose: () => void }) {
  const [picking, setPicking] = useState(false)
  const [viewing, setViewing] = useState(false)
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
  if (viewing && dish) return <RecipeSheet dish={dish} servings={entry.servings} onClose={() => setViewing(false)} />
  return (
    <Sheet title={dish?.name ?? 'Eintrag'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {dish && (
          <button className="btn btn-primary" onClick={() => setViewing(true)}>
            📖 Rezept ansehen
          </button>
        )}
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

function DishTile({ dish, planned, onOpen }: { dish: Dish; planned: boolean; onOpen: () => void }) {
  const data: DragData = { kind: 'dish', dishId: dish.id, label: dish.name }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `dish:${dish.id}`, data })
  const first = dish.tags[0]
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="card group relative flex min-h-[5rem] touch-manipulation select-none flex-col justify-between gap-1 overflow-hidden py-2.5 pr-2.5 pl-4 text-left transition hover:shadow-md active:scale-[0.98]"
      style={{
        opacity: isDragging ? 0.35 : 1,
        cursor: 'grab',
        background: first ? tagTint(first) : undefined,
      }}
      title={dish.name}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: first ? tagColor(first) : 'var(--border)' }} aria-hidden />
      <span className="line-clamp-2 pr-4 text-[15px] leading-tight font-semibold">{dish.name}</span>
      <span className="muted flex items-center gap-2 text-[11px] leading-none">
        {dish.tags.length > 0 ? <TagDots tags={dish.tags} max={1} /> : <span>{dish.ingredients.length === 0 ? 'Ohne Rezept' : 'Rezept'}</span>}
        {dish.servings && <span className="shrink-0">· {dish.servings} Port.</span>}
      </span>
      {planned && (
        <span
          className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white"
          style={{ background: 'var(--accent)' }}
          title="In dieser Woche bereits geplant"
          aria-label="In dieser Woche bereits geplant"
        >
          ✓
        </span>
      )}
    </button>
  )
}

function Tray({ dishes, plannedIds, draggingEntry, onOpenDish }: { dishes: Dish[]; plannedIds: Set<string>; draggingEntry: boolean; onOpenDish: (d: Dish) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID })
  const f = useDishFilter(dishes)
  const [size, setSize] = useState<0 | 1 | 2>(() => {
    try {
      const raw = localStorage.getItem('tray-size')
      return raw === '0' ? 0 : raw === '2' ? 2 : 1
    } catch {
      return 1
    }
  })
  const collapsed = size === 0
  const changeSize = (n: 0 | 1 | 2) => {
    setSize(n)
    try {
      localStorage.setItem('tray-size', String(n))
    } catch {
      /* Speichern ist optional */
    }
  }

  return (
    <section
      ref={setNodeRef}
      aria-label="Menüs"
      className={`card flex shrink-0 flex-col overflow-hidden ${size === 0 ? '' : size === 1 ? 'max-h-[38%] min-h-40 md:max-h-[46%]' : 'max-h-[78%] min-h-40'}`}
      style={isOver && draggingEntry ? { outline: '2px dashed #dc2626' } : undefined}
    >
      <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
        {collapsed ? (
          <span className="flex-1 px-1 font-semibold">Menüs <span className="muted font-normal">({dishes.length})</span></span>
        ) : (
          <input
            className="input !min-h-10 py-1"
            type="search"
            placeholder={`Menü suchen (${dishes.length})…`}
            aria-label="Menüs durchsuchen"
            value={f.q}
            onChange={(e) => f.setQ(e.target.value)}
          />
        )}
        <button
          className="btn btn-icon !min-h-10 !min-w-10 shrink-0"
          aria-label="Menüliste verkleinern"
          title="Verkleinern"
          disabled={size === 0}
          onClick={() => changeSize((size - 1) as 0 | 1 | 2)}
        >
          ▴
        </button>
        <button
          className="btn btn-icon !min-h-10 !min-w-10 shrink-0"
          aria-label="Menüliste vergrössern"
          title="Vergrössern"
          disabled={size === 2}
          onClick={() => changeSize((size + 1) as 0 | 1 | 2)}
        >
          ▾
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="px-2">
            <TagFilter tags={f.tags} active={f.active} onToggle={f.toggle} onClear={f.clear} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
            {draggingEntry ? (
              <p className="muted py-4 text-center text-sm">Hierher ziehen, um den Eintrag zu entfernen</p>
            ) : dishes.length === 0 ? (
              <div className="py-3 text-center text-sm">
                <p className="muted mb-2">Noch keine Menüs vorhanden.</p>
                <Link to="/menus" className="btn btn-primary">Menüs anlegen</Link>
              </div>
            ) : f.list.length === 0 ? (
              <div className="py-3 text-center text-sm">
                <p className="muted mb-2">Keine Treffer.</p>
                <button className="btn !min-h-10" onClick={f.clear}>Filter zurücksetzen</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {f.list.map((d) => (
                  <DishTile key={d.id} dish={d} planned={plannedIds.has(d.id)} onOpen={() => onOpenDish(d)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function EntryChip({ entry, dish, onOpen }: { entry: PlanEntry; dish?: Dish; onOpen: () => void }) {
  const data: DragData = { kind: 'entry', label: dish?.name ?? 'Eintrag' }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id, data })
  const first = dish?.tags[0]
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="relative flex min-h-[4.5rem] w-full flex-1 touch-manipulation select-none flex-col justify-between gap-1.5 overflow-hidden rounded-xl py-2 pr-2.5 pl-4 text-left shadow-sm xl:min-h-24 transition hover:shadow-md active:scale-[0.98]"
      style={{ background: first ? tagTint(first) : 'var(--accent-soft)', opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: first ? tagColor(first) : 'var(--accent)' }} aria-hidden />
      <span className="line-clamp-2 text-[15px] leading-tight font-semibold [overflow-wrap:anywhere] xl:text-[15px]">{dish?.name ?? '(gelöscht)'}</span>
      <span className="muted flex items-center gap-1 text-xs leading-none">
        <span aria-hidden>👥</span>
        {entry.servings} Port.
      </span>
    </button>
  )
}

function SlotCell({
  date,
  slot,
  entry,
  dish,
  dragging,
  onAdd,
  onOpen,
}: {
  date: string
  slot: Slot
  entry?: PlanEntry
  dish?: Dish
  dragging: boolean
  onAdd: () => void
  onOpen: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}|${slot}` })
  return (
    <div
      ref={setNodeRef}
      className="flex min-w-0 flex-col rounded-xl p-0.5 transition"
      style={isOver ? { outline: '2px solid var(--accent)', outlineOffset: '-1px', background: 'var(--accent-soft)' } : undefined}
    >
      <div className="muted hidden items-center gap-1 px-1 pb-0.5 text-[11px] font-medium xl:flex">
        <span aria-hidden>{SLOT_ICON[slot]}</span>
        {SLOT_SHORT[slot]}
      </div>
      {entry ? (
        <EntryChip entry={entry} dish={dish} onOpen={onOpen} />
      ) : (
        <button
          className={`flex min-h-[4.5rem] w-full flex-1 items-center justify-center rounded-xl border-2 border-dashed text-2xl font-light xl:min-h-24 transition hover:bg-[var(--accent-soft)] ${
            dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'muted'
          }`}
          style={dragging ? undefined : { borderColor: 'var(--border)' }}
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
  const [recipeDish, setRecipeDish] = useState<Dish | null>(null)
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const today = todayISO()

  const entries = useLiveQuery(() => db.plan.where('date').between(days[0], days[6], true, true).toArray(), [weekStart])
  const dishes = useLiveQuery(() => db.dishes.orderBy('name').toArray(), [])
  const dishMap = useMemo(() => new Map((dishes ?? []).map((d) => [d.id, d])), [dishes])
  const open = entries?.find((e) => e.id === openId)
  const plannedIds = useMemo(() => new Set((entries ?? []).map((e) => e.dishId)), [entries])

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
    <div className="mx-auto flex h-full max-w-[1680px] flex-col gap-2.5">
      <div className="flex shrink-0 items-center gap-2">
        <button className="btn btn-icon" aria-label="Vorherige Woche" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
        <div className="flex-1 text-center leading-tight">
          <h1 className="text-lg font-bold">KW {isoWeek(weekStart)}</h1>
          <p className="muted text-xs whitespace-nowrap">{formatRange(days[0], days[6])}</p>
          <div
            className="mx-auto mt-1 h-1.5 w-28 overflow-hidden rounded-full"
            style={{ background: 'var(--border)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={14}
            aria-valuenow={entries?.length ?? 0}
            aria-label="Geplante Mahlzeiten"
            title={`${entries?.length ?? 0} von 14 Mahlzeiten geplant`}
          >
            <div className="h-full rounded-full transition-all" style={{ width: `${((entries?.length ?? 0) / 14) * 100}%`, background: 'var(--accent)' }} />
          </div>
        </div>
        <button className="chip" onClick={() => setWeekStart(startOfWeek(todayISO()))}>Heute</button>
        <Link to={`/plan/druck?from=${days[0]}&to=${days[6]}`} className="chip !px-2.5" aria-label="Wochenplan drucken" title="Drucken">🖨️</Link>
        <button className="btn btn-icon" aria-label="Nächste Woche" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <Tray dishes={dishes ?? []} plannedIds={plannedIds} draggingEntry={dragging?.kind === 'entry'} onOpenDish={setRecipeDish} />

        <div className="muted grid shrink-0 grid-cols-[3.5rem_1fr_1fr] gap-1.5 px-1.5 text-center text-xs xl:hidden" aria-hidden>
          <span />
          <span>{SLOT_ICON.lunch} {SLOT_SHORT.lunch}</span>
          <span>{SLOT_ICON.dinner} {SLOT_SHORT.dinner}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2.5 pb-2 xl:grid-cols-7 xl:gap-3">
            {days.map((d) => {
              const p = dayParts(d)
              const isToday = d === today
              const isPast = d < today
              const weekend = [0, 6].includes(fromISO(d).getDay())
              return (
                <section
                  key={d}
                  className="card grid grid-cols-[3.5rem_1fr_1fr] gap-1.5 overflow-hidden p-1.5 transition xl:grid-cols-1 xl:content-start xl:gap-2 xl:p-2"
                  style={{
                    opacity: isPast ? 0.72 : 1,
                    background: weekend ? 'color-mix(in srgb, var(--accent-soft) 35%, var(--surface))' : undefined,
                    ...(isToday ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : {}),
                  }}
                  aria-label={isToday ? `${p.weekday} ${p.date}, heute` : `${p.weekday} ${p.date}`}
                >
                  <h2 className="flex flex-col items-center justify-center leading-none xl:flex-row xl:justify-start xl:gap-2 xl:px-1 xl:pt-0.5">
                    <span className={`text-[10px] font-bold tracking-wider uppercase xl:text-[11px] ${isToday ? 'text-[var(--accent)]' : 'muted'}`}>
                      {p.weekday.replace('.', '')}
                    </span>
                    <span
                      className={`mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-base font-bold xl:mt-0 ${
                        isToday ? 'bg-[var(--accent)] text-white' : ''
                      }`}
                    >
                      {fromISO(d).getDate()}
                    </span>
                    {isToday && (
                      <span className="ml-auto hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white xl:inline" style={{ background: 'var(--accent)' }}>
                        Heute
                      </span>
                    )}
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
                        dragging={dragging !== null}
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
            <div className="card rotate-2 px-4 py-2.5 text-sm font-semibold shadow-2xl" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
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
      {recipeDish && <RecipeSheet dish={recipeDish} onClose={() => setRecipeDish(null)} />}
      {open && <EntrySheet entry={open} dish={dishMap.get(open.dishId)} week={days} onClose={() => setOpenId(null)} />}
    </div>
  )
}
