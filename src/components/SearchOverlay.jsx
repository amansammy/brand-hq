import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Icon } from '../lib/icons.jsx'

const SOURCES = [
  { type: 'task', table: 'tasks', field: 'title', icon: 'tasks', route: (id) => `/tasks?open=${id}`, label: 'Task' },
  { type: 'note', table: 'notes', field: 'title', icon: 'notes', route: (id) => `/notes?open=${id}`, label: 'Note' },
  { type: 'file', table: 'files', field: 'name', icon: 'files', route: (id) => `/files?open=${id}`, label: 'File' },
  { type: 'drop', table: 'collections', field: 'name', icon: 'drops', route: (id) => `/drops?open=${id}`, label: 'Drop' },
  { type: 'arena', table: 'arenas', field: 'title', icon: 'trophy', route: (id) => `/arena?open=${id}`, label: 'Arena' },
]

export default function SearchOverlay({ open, onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setResults([]); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    let cancel = false
    setLoading(true)
    const t = setTimeout(async () => {
      const all = await Promise.all(SOURCES.map(async (s) => {
        const { data } = await supabase.from(s.table).select(`id, ${s.field}`).ilike(s.field, `%${q}%`).limit(5)
        return (data || []).map((r) => ({ id: r.id, label: r[s.field] || 'Untitled', src: s }))
      }))
      if (!cancel) { setResults(all.flat()); setLoading(false) }
    }, 220)
    return () => { cancel = true; clearTimeout(t) }
  }, [q])

  if (!open) return null

  function go(r) { onClose(); navigate(r.src.route(r.id)) }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative card w-full max-w-xl shadow-xl animate-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Icon name="search" size={18} className="text-faint" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks, notes, files, drops, arenas…"
            className="flex-1 h-14 bg-transparent outline-none text-[15px]" />
          <kbd className="text-[11px] text-faint border border-line rounded px-1.5 py-0.5 hidden sm:block">Esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          {q.trim() && !loading && results.length === 0 && (
            <p className="text-sm text-faint text-center py-10">No matches for "{q}".</p>
          )}
          {results.map((r) => (
            <button key={`${r.src.type}:${r.id}`} onClick={() => go(r)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-canvas border-b border-line last:border-0">
              <div className="h-8 w-8 rounded-lg bg-accent-soft text-accent grid place-items-center shrink-0"><Icon name={r.src.icon} size={16} /></div>
              <span className="text-sm flex-1 truncate">{r.label}</span>
              <span className="text-[11px] text-faint">{r.src.label}</span>
            </button>
          ))}
          {!q.trim() && <p className="text-sm text-faint text-center py-10">Type to search across everything.</p>}
        </div>
      </div>
    </div>
  )
}
