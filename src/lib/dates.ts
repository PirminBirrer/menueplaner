export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Montag der Woche, in der das Datum liegt. */
export function startOfWeek(iso: string): string {
  const d = fromISO(iso)
  const diff = (d.getDay() + 6) % 7
  return addDays(iso, -diff)
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export const todayISO = () => toISO(new Date())

export function formatDay(iso: string): string {
  return fromISO(iso).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

export function formatRange(a: string, b: string): string {
  const f = (s: string) => fromISO(s).toLocaleDateString('de-CH', { day: 'numeric', month: 'long' })
  return `${f(a)} – ${f(b)}`
}

/** ISO-Kalenderwoche. */
export function isoWeek(iso: string): number {
  const d = fromISO(iso)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
