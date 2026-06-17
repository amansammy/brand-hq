import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar } from './ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { timeAgo } from '../lib/util.js'

export default function NotificationBell({ variant = 'sidebar' }) {
  const { user, profiles } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: 'Someone' }
  const unread = items.filter((n) => !n.read).length

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
    setItems(data || [])
  }, [user])

  useEffect(() => {
    load()
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const r = Notification.requestPermission()
        if (r && typeof r.then === 'function') r.catch(() => {})
      }
    } catch (e) { /* notifications unsupported/blocked — ignore */ }
    if (!user) return
    const chName = `notif-${user.id}-${variant}-${Math.random().toString(36).slice(2)}`
    const ch = supabase.channel(chName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((cur) => [payload.new, ...cur])
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
              new Notification('Brand HQ', { body: payload.new.body || 'New activity', icon: '/icon-192.png' })
            }
          } catch (e) {}
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user, load])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function openItem(n) {
    if (!n.read) { await supabase.from('notifications').update({ read: true }).eq('id', n.id); setItems((c) => c.map((x) => x.id === n.id ? { ...x, read: true } : x)) }
    setOpen(false)
    if (n.link) navigate(n.link)
  }
  async function markAll() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setItems((c) => c.map((x) => ({ ...x, read: true })))
  }

  const btnClass = variant === 'sidebar'
    ? 'relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted hover:text-ink hover:bg-canvas w-full transition-colors'
    : 'relative p-2 text-muted hover:text-ink rounded-lg'

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen((o) => !o)} className={btnClass}>
        <span className="relative">
          <Icon name="bell" size={variant === 'sidebar' ? 18 : 19} />
          {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-accent text-on-accent text-[10px] font-semibold grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
        </span>
        {variant === 'sidebar' && <span>Notifications</span>}
      </button>

      {open && (
        <div className={`absolute z-50 w-80 max-w-[85vw] card shadow-xl animate-in overflow-hidden ${variant === 'sidebar' ? 'left-0 bottom-full mb-2' : 'right-0 top-full mt-2'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="font-display text-base">Notifications</span>
            {unread > 0 && <button onClick={markAll} className="text-xs text-accent hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-faint text-center py-10">You're all caught up.</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-line hover:bg-canvas transition-colors ${!n.read ? 'bg-accent-soft/30' : ''}`}>
                <Avatar profile={byId(n.actor)} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{n.body}</p>
                  <p className="text-xs text-faint mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
