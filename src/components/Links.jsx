import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { loadLinkCatalog, getLinksTo, linkRoute, LINK_TYPES } from '../lib/links.js'
import { Icon } from '../lib/icons.jsx'

// ---- Editor used inside the Task modal: pick what this task relates to ----
export function LinkEditor({ value, onChange }) {
  const [catalog, setCatalog] = useState([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => { loadLinkCatalog().then(setCatalog) }, [])

  const has = (t, i) => value.some((v) => v.to_type === t && v.to_id === i)
  const resolve = (t, i) => catalog.find((c) => c.type === t && c.id === i)
  const options = catalog.filter((c) => !has(c.type, c.id) &&
    (!q || c.label.toLowerCase().includes(q.toLowerCase())))

  return (
    <div>
      <div className={`flex flex-wrap gap-1.5 ${value.length ? 'mb-2' : ''}`}>
        {value.map((v) => {
          const r = v.to_type === 'brand_bible' ? { label: 'Brand bible', icon: 'brand' } : resolve(v.to_type, v.to_id)
          return (
            <span key={`${v.to_type}:${v.to_id}`} className="chip h-6 px-2 bg-accent-soft text-accent">
              <Icon name={r?.icon || LINK_TYPES[v.to_type]?.icon || 'link'} size={12} />
              {r?.label || LINK_TYPES[v.to_type]?.label || 'item'}
              <button onClick={() => onChange(value.filter((x) => !(x.to_type === v.to_type && x.to_id === v.to_id)))}
                className="hover:opacity-70"><Icon name="close" size={11} /></button>
            </span>
          )
        })}
      </div>

      {open ? (
        <div className="card p-2 animate-in">
          <input autoFocus className="input h-9 text-sm mb-2" placeholder="Search drops, arenas, files, notes…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {options.length === 0 && <p className="text-xs text-faint px-2 py-3 text-center">Nothing to link</p>}
            {options.map((c) => (
              <button key={`${c.type}:${c.id}`} type="button"
                onClick={() => { onChange([...value, { to_type: c.type, to_id: c.id }]); setQ('') }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas text-left">
                <Icon name={c.icon} size={15} className="text-faint shrink-0" />
                <span className="text-sm truncate flex-1">{c.label}</span>
                <span className="text-[11px] text-faint">{LINK_TYPES[c.type]?.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setOpen(false); setQ('') }} className="btn btn-soft h-8 w-full mt-2 text-xs">Done</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-sm text-muted hover:text-accent flex items-center gap-1">
          <Icon name="link" size={15} /> Link to something
        </button>
      )}
    </div>
  )
}

// ---- Reverse view for a module page: tasks linked to this entity ----
export function LinkedTasks({ toType, toId }) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState(null)

  const load = useCallback(async () => {
    const links = await getLinksTo(toType, toId)
    const ids = links.filter((l) => l.from_type === 'task').map((l) => l.from_id)
    if (!ids.length) { setTasks([]); return }
    const { data } = await supabase.from('tasks').select('id,title,status').in('id', ids)
    setTasks(data || [])
  }, [toType, toId])

  useEffect(() => { load() }, [load])

  if (tasks === null) return null
  if (tasks.length === 0) return <p className="text-sm text-faint">No linked tasks yet.</p>

  return (
    <div className="space-y-1.5">
      {tasks.map((t) => (
        <button key={t.id} onClick={() => navigate(`/tasks?open=${t.id}`)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-line hover:border-line-strong text-left">
          <Icon name={t.status === 'done' ? 'check' : 'tasks'} size={15} className={t.status === 'done' ? 'text-accent' : 'text-faint'} />
          <span className={`text-sm flex-1 truncate ${t.status === 'done' ? 'line-through text-faint' : ''}`}>{t.title}</span>
          <Icon name="chevronDown" size={14} className="-rotate-90 text-faint" />
        </button>
      ))}
    </div>
  )
}
