import { useRef, useState } from 'react'
import { exportAll, importAll } from '../data/repo'
import { todayISO } from '../lib/dates'

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  async function doExport() {
    const blob = new Blob([await exportAll()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `menueplaner-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function doImport(file?: File) {
    if (!file) return
    if (!confirm('Alle aktuellen Daten werden durch das Backup ersetzt. Fortfahren?')) return
    try {
      await importAll(await file.text())
      setMsg('Backup wurde importiert.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import fehlgeschlagen.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-3 text-2xl font-bold">Mehr</h1>
      <section className="card flex flex-col gap-3 p-4">
        <h2 className="font-semibold">Backup</h2>
        <p className="muted text-sm">
          Deine Daten liegen nur auf diesem Gerät (im Browser). Exportiere sie regelmässig als Datei, um sie zu sichern
          oder auf ein anderes Gerät zu übertragen.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={doExport}>Exportieren</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Importieren</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </section>
    </div>
  )
}
