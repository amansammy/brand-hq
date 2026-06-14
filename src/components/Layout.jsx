import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon } from '../lib/icons.jsx'
import { Avatar } from './ui.jsx'
import NotificationBell from './NotificationBell.jsx'
import SearchOverlay from './SearchOverlay.jsx'
import ProfileSettings from './ProfileSettings.jsx'
import { useAuth } from '../lib/auth.jsx'

const GROUPS = [
  {
    label: 'Build',
    items: [
      { to: '/', label: 'Home', icon: 'home', end: true },
      { to: '/feed', label: 'Feed', icon: 'feed' },
      { to: '/drops', label: 'Drops', icon: 'drops' },
      { to: '/tasks', label: 'Tasks', icon: 'tasks' },
      { to: '/files', label: 'Files', icon: 'files' },
      { to: '/notes', label: 'Notes', icon: 'notes' },
      { to: '/budget', label: 'Budget', icon: 'wallet' },
    ],
  },
  {
    label: 'Brand',
    items: [
      { to: '/brand', label: 'Brand bible', icon: 'brand' },
      { to: '/arena', label: 'Logo arena', icon: 'trophy' },
      { to: '/mood', label: 'Mood', icon: 'mood' },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.items)
const BOTTOM = ['/', '/feed', '/drops', '/tasks']
const MORE = ALL.filter((i) => !BOTTOM.includes(i.to))

export default function Layout() {
  const { user, profiles, signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.theme = next ? 'dark' : 'light' } catch (e) {}
  }
  const me = profiles.find((p) => p.id === user?.id) || { id: user?.id, display_name: user?.email }
  const moreActive = MORE.some((i) => loc.pathname.startsWith(i.to))

  return (
    <div className="min-h-full">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden sm:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-surface/70 backdrop-blur px-4 py-5">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-ink text-canvas flex items-center justify-center font-display text-lg">B</div>
          <span className="font-display text-lg tracking-tight">Brand HQ</span>
        </div>

        <button onClick={() => setSearchOpen(true)}
          className="flex items-center gap-3 px-3 py-2 mb-4 rounded-xl text-sm text-muted hover:text-ink hover:bg-canvas w-full border border-line">
          <Icon name="search" size={17} /> <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] text-faint border border-line rounded px-1">⌘K</kbd>
        </button>

        <nav className="flex flex-col gap-5 overflow-y-auto">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint px-3 mb-1.5">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink hover:bg-canvas'
                      }`}>
                    <Icon name={n.icon} size={18} />
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-line space-y-2">
          <NotificationBell variant="sidebar" />
          <button onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted hover:text-ink hover:bg-canvas w-full transition-colors">
            <Icon name={dark ? 'sun' : 'moon'} size={18} />
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={() => setProfileOpen(true)} className="flex items-center gap-3 px-1 w-full text-left hover:opacity-80">
            <Avatar profile={me} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{me.display_name}</p>
              <p className="text-xs text-faint flex items-center gap-1"><Icon name="settings" size={12} /> Profile &amp; settings</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-ink text-canvas flex items-center justify-center font-display">B</div>
          <span className="font-display text-base">Brand HQ</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen(true)} className="p-2 text-muted hover:text-ink rounded-lg"><Icon name="search" size={19} /></button>
          <NotificationBell variant="icon" />
          <button onClick={toggleTheme} className="p-2 text-muted hover:text-ink rounded-lg"><Icon name={dark ? 'sun' : 'moon'} size={19} /></button>
          <button onClick={() => setProfileOpen(true)}><Avatar profile={me} size={30} /></button>
        </div>
      </header>

      {/* ---------- Main ---------- */}
      <main className="sm:ml-60 px-4 sm:px-8 py-6 pb-24 sm:pb-10 max-w-5xl mx-auto">
        <Outlet />
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-canvas/95 backdrop-blur flex justify-around px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {ALL.filter((i) => BOTTOM.includes(i.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] font-medium ${isActive ? 'text-accent' : 'text-faint'}`}>
            <Icon name={n.icon} size={21} />
            {n.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] font-medium ${moreActive ? 'text-accent' : 'text-faint'}`}>
          <Icon name="more" size={21} /> More
        </button>
      </nav>

      {/* ---------- Mobile "More" sheet ---------- */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute bottom-0 inset-x-0 card rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-line-strong rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {MORE.map((n) => (
                <NavLink key={n.to} to={n.to} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-2 py-4 rounded-xl border text-xs font-medium ${
                      isActive ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
                    }`}>
                  <Icon name={n.icon} size={22} />
                  {n.label}
                </NavLink>
              ))}
            </div>
            <button onClick={toggleTheme} className="btn btn-soft w-full mt-3">
              <Icon name={dark ? 'sun' : 'moon'} size={16} /> {dark ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      {profileOpen && <ProfileSettings onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
