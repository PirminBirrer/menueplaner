import type { ReactNode } from 'react'

export default function EmptyState({ icon, title, hint, children }: { icon: string; title: string; hint: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="text-5xl" aria-hidden>{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="muted max-w-xs">{hint}</p>
      {children && <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}
