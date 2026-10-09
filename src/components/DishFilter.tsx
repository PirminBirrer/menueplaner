import { useMemo, useState } from 'react'
import type { Dish } from '../data/types'
import { tagColor } from '../lib/tags'

/** Suche + Tag-Filter (alle gewählten Tags müssen zutreffen). */
export function useDishFilter(dishes: Dish[]) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState<string[]>([])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of dishes) for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([tag, count]) => ({ tag, count }))
  }, [dishes])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return dishes.filter((d) => (!needle || d.name.toLowerCase().includes(needle)) && active.every((t) => d.tags.includes(t)))
  }, [dishes, q, active])

  return {
    q,
    setQ,
    active,
    tags,
    list,
    filtered: q.trim() !== '' || active.length > 0,
    toggle: (t: string) => setActive((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t])),
    clear: () => {
      setQ('')
      setActive([])
    },
  }
}

/** Horizontal scrollbare Tag-Chips mit Farbpunkt und Anzahl. */
export function TagFilter({
  tags,
  active,
  onToggle,
  onClear,
}: {
  tags: { tag: string; count: number }[]
  active: string[]
  onToggle: (tag: string) => void
  onClear: () => void
}) {
  if (tags.length === 0) return null
  return (
    <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none]" role="group" aria-label="Nach Tag filtern">
      <button className="chip shrink-0 !min-h-8" aria-pressed={active.length === 0} onClick={onClear}>
        Alle
      </button>
      {tags.map(({ tag, count }) => (
        <button key={tag} className="chip shrink-0 gap-1.5 !min-h-8" aria-pressed={active.includes(tag)} onClick={() => onToggle(tag)}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: tagColor(tag) }} aria-hidden />
          {tag}
          <span className="muted text-xs">{count}</span>
        </button>
      ))}
    </div>
  )
}

/** Kleine Tag-Zeile (erste zwei Tags mit Farbpunkt, Rest als +n). */
export function TagDots({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null
  return (
    <span className="flex min-w-0 items-center gap-2">
      {tags.slice(0, max).map((t) => (
        <span key={t} className="flex min-w-0 items-center gap-1">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tagColor(t) }} aria-hidden />
          <span className="truncate">{t}</span>
        </span>
      ))}
      {tags.length > max && <span>+{tags.length - max}</span>}
    </span>
  )
}
