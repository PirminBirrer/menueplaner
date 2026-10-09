/** Einheiten werden auf eine Basiseinheit normalisiert: g (Masse), ml (Volumen) oder die Einheit selbst. */

const MAP: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 },
  gr: { base: 'g', factor: 1 },
  gramm: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  cl: { base: 'ml', factor: 10 },
  dl: { base: 'ml', factor: 100 },
  l: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  el: { base: 'EL', factor: 1 },
  essl: { base: 'EL', factor: 1 },
  esslöffel: { base: 'EL', factor: 1 },
  tl: { base: 'TL', factor: 1 },
  teelöffel: { base: 'TL', factor: 1 },
  stk: { base: 'Stk', factor: 1 },
  stück: { base: 'Stk', factor: 1 },
  stueck: { base: 'Stk', factor: 1 },
}

export function normalizeUnit(unit?: string): string {
  const u = (unit ?? '').trim().replace(/\.$/, '')
  if (!u) return ''
  return MAP[u.toLowerCase()]?.base ?? u
}

/** Rechnet Menge+Einheit auf die Basiseinheit um. */
export function toBase(qty: number | undefined, unit?: string): { qty?: number; unit: string } {
  const u = (unit ?? '').trim().replace(/\.$/, '')
  const m = MAP[u.toLowerCase()]
  if (!m) return { qty, unit: u }
  return { qty: qty === undefined ? undefined : qty * m.factor, unit: m.base }
}

export function formatNumber(n: number): string {
  const r = Math.round(n * 100) / 100
  return r.toLocaleString('de-CH', { maximumFractionDigits: 2 })
}

/** Schöne Darstellung: 1500 g → "1.5 kg". */
export function formatQuantity(qty?: number, unit?: string): string {
  if (qty === undefined) return unit ? '' : ''
  if (unit === 'g' && qty >= 1000) return `${formatNumber(qty / 1000)} kg`
  if (unit === 'ml' && qty >= 1000) return `${formatNumber(qty / 1000)} l`
  return unit ? `${formatNumber(qty)} ${unit}` : formatNumber(qty)
}

/** Parst "200 g Spaghetti", "1,5 l Milch", "2 Eier" oder "Salz". */
export function parseIngredientLine(line: string): { qty?: number; unit?: string; name: string } {
  const m = line.trim().match(/^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*([^\d\s]+)?\s*(.*)$/)
  if (!m) return { name: line.trim() }
  const qty = m[1].includes('/')
    ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1])
    : Number(m[1].replace(',', '.'))
  const second = m[2] ?? ''
  const rest = m[3] ?? ''
  if (second && MAP[second.toLowerCase().replace(/\.$/, '')] && rest) {
    return { qty, unit: second, name: rest }
  }
  return { qty, name: [second, rest].filter(Boolean).join(' ') }
}
