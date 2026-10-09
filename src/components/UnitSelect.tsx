export const UNITS: { value: string; label: string }[] = [
  { value: 'g', label: 'g (Gramm)' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'dl', label: 'dl' },
  { value: 'l', label: 'l (Liter)' },
  { value: '', label: 'Anzahl' },
  { value: 'EL', label: 'EL' },
  { value: 'TL', label: 'TL' },
  { value: 'Prise', label: 'Prise' },
  { value: 'Bund', label: 'Bund' },
  { value: 'Dose', label: 'Dose' },
  { value: 'Pack', label: 'Packung' },
]

export const DEFAULT_UNIT = 'g'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
  'aria-label'?: string
}

/** Einheiten-Auswahl; "Anzahl" entspricht einer Menge ohne Einheit (z. B. 2 Eier). */
export default function UnitSelect({ value, onChange, className = '', ...rest }: Props) {
  // Bereits gespeicherte, nicht in der Liste enthaltene Einheiten (z. B. "Stk") bleiben auswählbar.
  const known = UNITS.some((u) => u.value === value)
  return (
    <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={rest['aria-label'] ?? 'Einheit'}>
      {!known && <option value={value}>{value}</option>}
      {UNITS.map((u) => (
        <option key={u.value} value={u.value}>
          {u.label}
        </option>
      ))}
    </select>
  )
}
