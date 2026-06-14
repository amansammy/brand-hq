import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '../lib/icons.jsx'
import { Avatar } from './ui.jsx'
import { useAuth } from '../lib/auth.jsx'

const NAV = [
  { to: '/', label: 'Feed', icon: 'feed', end: true },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/files', label: 'Files', icon: 'files' },
  { to: '/notes', label: 'Notes', icon: 'notes' },
  { to: '/mood', label: 'Mood', icon: 'mood' },
]

export default function Layout() {
  const { user, profiles, signOut } = useAuth()
  const me = profiles.find((p) => p.id === user?.id) || { id: user?.id, display_name: user?.email }

  return (
    <div className="min-h-full">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden sm:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-surface/70 backdrop-blur px-4 py-5">
        <div className="flex items-center gap-2.5 px-2 mb-7">
          <div className="h-9 w-9 rounded-xl bg-ink text-canvas flex items-center justify-center font-display text-lg">B</div>
          <span className="font-display text-lg tracking-tight">Brand HQ</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink hover:bg-canvas'
                }`}>
              <Icon name={n.icon} size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-line">
          <div className="flex items-center gap-3 px-1">
            <Avatar profile={me} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{me.display_name}</p>
              <button onClick={signOut} className="text-xs text-faint hover:text-accent flex items-center gap-1">
                <Icon name="logout" size={13} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-ink text-canvas flex items-center justify-center font-display">B</div>
          <span className="font-display text-base">Brand HQ</span>
        </div>
        <button onClick={signOut} className="flex items-center gap-2">
          <Avatar profile={me} size={30} />
        </button>
      </header>

      {/* ---------- Main ---------- */}
      <main className="sm:ml-60 px-4 sm:px-8 py-6 pb-24 sm:pb-10 max-w-5xl mx-auto">
        <Outlet />
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-canvas/95 backdrop-blur flex justify-around px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] font-medium ${
                isActive ? 'text-accent' : 'text-faint'
              }`}>
            <Icon name={n.icon} size={21} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
