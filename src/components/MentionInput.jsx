import { useState, useRef } from 'react'
import { Avatar } from './ui.jsx'

// Render text with @mentions of known profiles highlighted.
export function MentionText({ text, profiles }) {
  if (!text) return null
  const names = profiles.map((p) => p.display_name).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!names.length) return text
  const re = new RegExp('@(' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi')
  const out = []
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<span key={m.index} className="text-accent font-medium">{m[0]}</span>)
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

// Text field with @mention autocomplete. Works as input or textarea.
export default function MentionInput({ value, onChange, profiles, placeholder, className = '', rows, multiline, ...rest }) {
  const ref = useRef(null)
  const [menu, setMenu] = useState(null) // { query, at }  (at = index of '@')
  const Tag = multiline ? 'textarea' : 'input'

  function handleChange(e) {
    onChange(e.target.value)
    const caret = e.target.selectionStart
    const before = e.target.value.slice(0, caret)
    const m = before.match(/(?:^|\s)@(\w*)$/)
    if (m) setMenu({ query: m[1], at: caret - m[1].length - 1 })
    else setMenu(null)
  }

  const matches = menu
    ? profiles.filter((p) => (p.display_name || '').toLowerCase().startsWith(menu.query.toLowerCase())).slice(0, 5)
    : []

  function pick(p) {
    const caret = ref.current.selectionStart
    const next = value.slice(0, menu.at) + '@' + p.display_name + ' ' + value.slice(caret)
    onChange(next)
    setMenu(null)
    requestAnimationFrame(() => ref.current?.focus())
  }

  return (
    <div className="relative flex-1">
      <Tag ref={ref} value={value} onChange={handleChange} onBlur={() => setTimeout(() => setMenu(null), 120)}
        placeholder={placeholder} rows={rows} className={className} {...rest} />
      {menu && matches.length > 0 && (
        <div className="absolute z-50 left-0 top-full mt-1 w-56 card shadow-lg overflow-hidden animate-in">
          {matches.map((p) => (
            <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(p) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-canvas text-left">
              <Avatar profile={p} size={22} /> <span className="text-sm">{p.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
