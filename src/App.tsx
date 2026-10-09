import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import MenusPage from './pages/MenusPage'
import PlanPage from './pages/PlanPage'
import ListPage from './pages/ListPage'
import ArchivePage from './pages/ArchivePage'
import PrintPage from './pages/PrintPage'
import SettingsPage from './pages/SettingsPage'

const tabs = [
  { to: '/menus', label: 'Menüs', icon: '🍽️' },
  { to: '/plan', label: 'Plan', icon: '📅' },
  { to: '/liste', label: 'Einkauf', icon: '🛒' },
  { to: '/einstellungen', label: 'Mehr', icon: '⚙️' },
]

export default function App() {
  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col md:flex-row">
      <nav
        aria-label="Hauptnavigation"
        className="card order-2 grid grid-cols-4 rounded-b-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:order-1 md:my-4 md:ml-4 md:flex md:w-48 md:flex-col md:gap-1 md:self-start md:rounded-2xl md:border md:p-2"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium md:min-h-12 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-base ${
                isActive ? 'text-[var(--accent)] md:bg-[var(--accent-soft)]' : 'muted'
              }`
            }
          >
            <span className="text-xl" aria-hidden>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <main className="order-1 min-h-0 flex-1 overflow-y-auto p-4 md:order-2 md:p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/plan" replace />} />
          <Route path="/menus" element={<MenusPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/plan/druck" element={<PrintPage />} />
          <Route path="/liste" element={<ListPage />} />
          <Route path="/liste/archiv" element={<ArchivePage />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Routes>
      </main>
    </div>
  )
}
