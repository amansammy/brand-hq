import { useEffect } from 'react'
import { Icon } from '../lib/icons.jsx'
import { initials, colorFromId } from '../lib/util.js'

export function Avatar({ profile, size = 32 }) {
  const name = profile?.display_name || '?'
  const style = {
    width: size, height: size, fontSize: size * 0.4,
    background: colorFromId(profile?.id || name),
  }
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={name} style={{ width: size, height: size }}
      className="rounded-full object-cover" />
  }
  return (
    <div style={style}
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none">
      {initials(name)}
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-faint">
      <div className="h-6 w-6 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function EmptyState({ icon = 'feed', title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {subtitle && <p className="text-sm text-muted mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative card w-full ${maxWidth} shadow-xl animate-in rounded-b-none sm:rounded-2xl max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-lg">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-ink p-1 -mr-1 rounded-lg hover:bg-canvas">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
