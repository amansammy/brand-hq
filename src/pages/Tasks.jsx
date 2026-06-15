import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, DragOverlay,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { supabase, logActivity, purgeEntity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { LinkEditor } from '../components/Links.jsx'
import { getLinksFrom, syncLinks } from '../lib/links.js'
import { notify } from '../lib/notify.js'
import { Icon } from '../lib/icons.jsx'
import { prettyDate, todayISO } from '../lib/util.js'
import { isPast, isToday, parseISO, addDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths } from 'date-fns'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Natural-language quick-add: "design tee friday !high @aman" -> fields
function parseQuickAdd(text, profiles) {
  let t = ` ${text} `
  let priority = null, assignee = null, due = null
  const pm = t.match(/\s!(high|med|low)\b/i)
  if (pm) { priority = pm[1].toLowerCase(); t = t.replace(pm[0], ' ') }
  if (!priority && /\burgent\b/i.test(t)) { priority = 'high'; t = t.replace(/\burgent\b/i, ' ') }
  const am = t.match(/\s@(\w+)/)
  if (am) { const p = profiles.find((p) => (p.display_name || '').toLowerCase().startsWith(am[1].toLowerCase())); if (p) { assignee = p.id; t = t.replace(am[0], ' ') } }
  const lower = t.toLowerCase()
  const setDue = (d) => { due = format(d, 'yyyy-MM-dd') }
  if (/\btoday\b/.test(lower)) { setDue(new Date()); t = t.replace(/\btoday\b/i, ' ') }
  else if (/\btomorrow\b/.test(lower)) { setDue(addDays(new Date(), 1)); t = t.replace(/\btomorrow\b/i, ' ') }
  else {
    const inm = lower.match(/\bin (\d+) days?\b/)
    if (inm) { setDue(addDays(new Date(), parseInt(inm[1], 10))); t = t.replace(inm[0], ' ') }
    else {
      for (let i = 0; i < 7; i++) {
        if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(lower)) {
          const cur = new Date().getDay(); let diff = (i - cur + 7) % 7; if (diff === 0) diff = 7
          setDue(addDays(new Date(), diff)); t = t.replace(new RegExp(`\\b${WEEKDAYS[i]}\\b`, 'i'), ' '); break
        }
      }
    }
  }
  return { title: t.replace(/\s+/g, ' ').trim(), priority: priority || 'med', assignee, due_date: due }
}

const COLUMNS = [
  { key: 'todo', label: 'To-do' },
  { key: 'doing', label: 'In progress' },
  { key: 'done', label: 'Done' },
]
const PRIORITY = {
  high: { label: 'High', dot: '#bf5b3c', cls: 'bg-accent-soft text-accent' },
  med: { label: 'Medium', dot: '#d2a24c', cls: 'bg-amber-50 text-amber-700' },
  low: { label: 'Low', dot: '#9aa0a6', cls: 'bg-canvas text-muted' },
}

function dueState(date, status) {
  if (!date || status === 'done') return null
  const d = parseISO(date)
  if (isToday(d)) return 'today'
  if (isPast(d)) return 'over'
  return 'future'
}

export default function Tasks() {
  const { user, profiles } = useAuth()
  const [tasks, setTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [linkCounts, setLinkCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [view, setView] = useState('board')
  const [defaultDue, setDefaultDue] = useState(null)
  const [q, setQ] = useState('')
  const [fAssignee, setFAssignee] = useState('')
  const [fPriority, setFPriority] = useState('')
  const [msTitle, setMsTitle] = useState('')
  const [msDate, setMsDate] = useState('')
  const [params, setParams] = useSearchParams()
  const byId = (id) => profiles.find((p) => p.id === id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )

  const load = useCallback(async () => {
    const [t, m, l] = await Promise.all([
      supabase.from('tasks').select('*').order('position').order('created_at'),
      supabase.from('milestones').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('links').select('from_id').eq('from_type', 'task'),
    ])
    setTasks(t.data || [])
    setMilestones(m.data || [])
    const counts = {}
    ;(l.data || []).forEach((r) => { counts[r.from_id] = (counts[r.from_id] || 0) + 1 })
    setLinkCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  useEffect(() => {
    const id = params.get('open')
    if (id && tasks.length) { const t = tasks.find((x) => x.id === id); if (t) setEditing(t) }
  }, [params, tasks])

  function closeEditor() { setEditing(null); if (params.get('open')) setParams({}, { replace: true }) }

  const filtered = useMemo(() => tasks.filter((t) => {
    if (q && !(`${t.title} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase()))) return false
    if (fAssignee === 'none' && t.assignee) return false
    if (fAssignee && fAssignee !== 'none' && t.assignee !== fAssignee) return false
    if (fPriority && t.priority !== fPriority) return false
    return true
  }), [tasks, q, fAssignee, fPriority])

  async function setStatus(task, status) {
    if (task.status === status) return
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status } : t)))
    await supabase.from('tasks').update({ status }).eq('id', task.id)
    if (status === 'done') logActivity({ verb: 'completed', entity_type: 'task', entity_id: task.id, summary: `completed a task: ${task.title}`, meta: { title: task.title } })
  }
  async function removeTask(task) {
    await supabase.from('tasks').delete().eq('id', task.id)
    await purgeEntity('task', task.id)
    closeEditor(); load()
  }
  async function addMilestone(e) {
    e.preventDefault()
    if (!msTitle.trim()) return
    await supabase.from('milestones').insert({ title: msTitle.trim(), due_date: msDate || null, created_by: user.id })
    setMsTitle(''); setMsDate('')
  }
  async function toggleMilestone(m) {
    setMilestones((cur) => cur.map((x) => x.id === m.id ? { ...x, done: !x.done } : x))
    await supabase.from('milestones').update({ done: !m.done }).eq('id', m.id)
  }
  async function deleteMilestone(m) {
    setMilestones((cur) => cur.filter((x) => x.id !== m.id))
    await supabase.from('milestones').delete().eq('id', m.id)
  }

  function onDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (task && over.id !== task.status) setStatus(task, over.id)
  }

  const activeTask = tasks.find((t) => t.id === activeId)
  const incompleteIds = new Set(tasks.filter((t) => t.status !== 'done').map((t) => t.id))
  const blockedIds = new Set(tasks.filter((t) => (t.depends_on || []).some((id) => incompleteIds.has(id))).map((t) => t.id))
  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Tasks & timeline" subtitle="Who's on what, and what's due next."
        action={<button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> New task</button>} />

      {/* Milestones */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="flag" size={16} className="text-accent" /><h2 className="font-display text-base">Milestones</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {milestones.length === 0 && <p className="text-sm text-faint">No milestones yet — add your launch target below.</p>}
          {milestones.map((m) => (
            <div key={m.id} className={`group chip h-auto py-2 px-3 border ${m.done ? 'border-line bg-canvas text-faint line-through' : 'border-line-strong'}`}>
              <button onClick={() => toggleMilestone(m)} className="flex items-center gap-1.5">
                <Icon name={m.done ? 'check' : 'flag'} size={13} className={m.done ? 'text-accent' : 'text-faint'} />
                {m.title}{m.due_date && <span className="text-faint font-normal">· {prettyDate(m.due_date)}</span>}
              </button>
              <button onClick={() => deleteMilestone(m)} className="text-faint hover:text-accent ml-0.5"><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
        <form onSubmit={addMilestone} className="flex flex-col sm:flex-row gap-2">
          <input className="input sm:flex-1 min-w-0" placeholder="Milestone (e.g. Launch drop 01)" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
          <input className="input w-full sm:w-44 min-w-0" type="date" min={todayISO()} value={msDate}
            onChange={(e) => { const v = e.target.value; setMsDate(v && v < todayISO() ? todayISO() : v) }} />
          <button className="btn btn-soft shrink-0" disabled={!msTitle.trim()}><Icon name="plus" size={16} /> Add</button>
        </form>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <input className="input pl-9" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Icon name="feed" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        </div>
        <select className="input w-auto" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
        <select className="input w-auto" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="">Any priority</option>
          {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex rounded-lg border border-line-strong overflow-hidden">
          <button onClick={() => setView('board')} className={`h-10 px-3 text-sm flex items-center gap-1.5 ${view === 'board' ? 'bg-accent-soft text-accent' : 'text-muted'}`}><Icon name="tasks" size={15} /> Board</button>
          <button onClick={() => setView('list')} className={`h-10 px-3 text-sm flex items-center gap-1.5 border-l border-line-strong ${view === 'list' ? 'bg-accent-soft text-accent' : 'text-muted'}`}><Icon name="feed" size={15} /> List</button>
          <button onClick={() => setView('calendar')} className={`h-10 px-3 text-sm flex items-center gap-1.5 border-l border-line-strong ${view === 'calendar' ? 'bg-accent-soft text-accent' : 'text-muted'}`}><Icon name="calendar" size={15} /> Calendar</button>
        </div>
      </div>

      {view === 'board' ? (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id)} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <Column key={col.key} col={col} tasks={filtered.filter((t) => t.status === col.key)}
                byId={byId} linkCounts={linkCounts} blockedIds={blockedIds} onOpen={setEditing} onQuickAdd={async (text) => {
                  const p = parseQuickAdd(text, profiles)
                  const { data } = await supabase.from('tasks').insert({ title: p.title, status: col.key, priority: p.priority, assignee: p.assignee, due_date: p.due_date, created_by: user.id }).select().single()
                  if (data) logActivity({ verb: 'added', entity_type: 'task', entity_id: data.id, summary: `added a task: ${p.title}`, meta: { title: p.title } })
                }} />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} byId={byId} overlay /> : null}</DragOverlay>
        </DndContext>
      ) : view === 'list' ? (
        <ListView tasks={filtered} byId={byId} blockedIds={blockedIds} onOpen={setEditing} />
      ) : (
        <CalendarView tasks={filtered} milestones={milestones} byId={byId}
          onOpen={setEditing} onAddOnDay={(d) => { setDefaultDue(d); setEditing('new') }} />
      )}

      {editing && <TaskModal task={editing === 'new' ? null : editing} profiles={profiles} user={user}
        allTasks={tasks} defaultDue={defaultDue}
        allLabels={[...new Set(tasks.flatMap((t) => t.labels || []))]}
        onClose={() => { closeEditor(); setDefaultDue(null) }} onDelete={removeTask} />}
    </div>
  )
}

function Column({ col, tasks, byId, linkCounts, blockedIds, onOpen, onQuickAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 mb-2.5">
        <h3 className="text-sm font-semibold text-muted">{col.label}</h3>
        <span className="text-xs text-faint bg-canvas border border-line rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={`space-y-2.5 min-h-[80px] rounded-xl transition-colors ${isOver ? 'bg-accent-soft/40 outline outline-2 outline-dashed outline-accent/30' : ''}`}>
        {tasks.map((t) => <DraggableCard key={t.id} task={t} byId={byId} links={linkCounts[t.id] || 0} blocked={blockedIds?.has(t.id)} onOpen={onOpen} />)}
      </div>
      {adding ? (
        <form onSubmit={(e) => { e.preventDefault(); if (val.trim()) { onQuickAdd(val.trim()); setVal(''); setAdding(false) } }} className="mt-2">
          <input autoFocus className="input h-9 text-sm" placeholder="Task title…" value={val}
            onChange={(e) => setVal(e.target.value)} onBlur={() => !val && setAdding(false)} />
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 text-sm text-faint hover:text-accent flex items-center gap-1 px-1"><Icon name="plus" size={15} /> Add</button>
      )}
    </div>
  )
}

function DraggableCard({ task, byId, links, blocked, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onOpen(task)}>
      <TaskCard task={task} byId={byId} links={links} blocked={blocked} />
    </div>
  )
}

function TaskCard({ task, byId, overlay, links = 0, blocked }) {
  const a = byId(task.assignee)
  const ds = dueState(task.due_date, task.status)
  const subs = task.subtasks || []
  const subDone = subs.filter((s) => s.done).length
  return (
    <div className={`card p-3 cursor-pointer ${overlay ? 'shadow-xl rotate-2' : 'hover:border-line-strong'} transition-colors`}>
      <div className="flex items-start gap-2">
        <span className="h-2.5 w-2.5 rounded-full mt-1 shrink-0" style={{ background: PRIORITY[task.priority || 'med'].dot }} title={PRIORITY[task.priority || 'med'].label} />
        <p className={`text-sm font-medium leading-snug flex-1 ${task.status === 'done' ? 'line-through text-faint' : ''}`}>{task.title}</p>
      </div>
      {(task.labels?.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-2 ml-[18px]">
          {task.labels.map((l) => <span key={l} className="chip h-5 px-1.5 bg-canvas border border-line text-faint">{l}</span>)}
        </div>
      )}
      <div className="flex items-center justify-between mt-2.5 ml-[18px]">
        <div className="flex items-center gap-2">
          {a ? <Avatar profile={a} size={22} /> : <span className="text-[11px] text-faint">Unassigned</span>}
          {subs.length > 0 && (
            <span className="chip h-5 px-1.5 bg-canvas border border-line text-faint"><Icon name="check" size={11} /> {subDone}/{subs.length}</span>
          )}
          {links > 0 && (
            <span className="chip h-5 px-1.5 bg-accent-soft text-accent"><Icon name="link" size={11} /> {links}</span>
          )}
          {blocked && task.status !== 'done' && (
            <span className="chip h-5 px-1.5 bg-amber-50 text-amber-700" title="Blocked by an unfinished task"><Icon name="clock" size={11} /> Blocked</span>
          )}
        </div>
        {task.due_date && (
          <span className={`chip h-5 px-1.5 ${ds === 'over' ? 'bg-accent-soft text-accent' : ds === 'today' ? 'bg-amber-50 text-amber-700' : 'bg-canvas border border-line text-faint'}`}>
            <Icon name="calendar" size={11} /> {prettyDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

function ListView({ tasks, byId, blockedIds, onOpen }) {
  const [groupBy, setGroupBy] = useState('none')
  const groups = (() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, items: tasks }]
    if (groupBy === 'priority') return ['high', 'med', 'low'].map((p) => ({ key: p, label: PRIORITY[p].label, items: tasks.filter((t) => (t.priority || 'med') === p) })).filter((g) => g.items.length)
    if (groupBy === 'assignee') {
      const ids = [...new Set(tasks.map((t) => t.assignee || 'none'))]
      return ids.map((id) => ({ key: id, label: id === 'none' ? 'Unassigned' : (byId(id)?.display_name || '…'), items: tasks.filter((t) => (t.assignee || 'none') === id) }))
    }
    return COLUMNS.map((c) => ({ key: c.key, label: c.label, items: tasks.filter((t) => t.status === c.key) })).filter((g) => g.items.length)
  })()

  const Row = (t) => {
    const a = byId(t.assignee)
    const ds = dueState(t.due_date, t.status)
    return (
      <button key={t.id} onClick={() => onOpen(t)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-canvas transition-colors">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PRIORITY[t.priority || 'med'].dot }} />
        <span className={`text-sm font-medium flex-1 truncate ${t.status === 'done' ? 'line-through text-faint' : ''}`}>{t.title}</span>
        {blockedIds?.has(t.id) && t.status !== 'done' && <span className="chip h-5 px-1.5 bg-amber-50 text-amber-700">Blocked</span>}
        {t.labels?.slice(0, 2).map((l) => <span key={l} className="chip h-5 px-1.5 bg-canvas border border-line text-faint hidden sm:flex">{l}</span>)}
        {t.due_date && <span className={`text-xs hidden sm:inline ${ds === 'over' ? 'text-accent' : ds === 'today' ? 'text-amber-700' : 'text-faint'}`}>{prettyDate(t.due_date)}</span>}
        <span className="chip h-6 px-2 bg-canvas border border-line text-muted">{COLUMNS.find((c) => c.key === t.status)?.label}</span>
        {a ? <Avatar profile={a} size={24} /> : <span className="h-6 w-6 rounded-full bg-canvas border border-line shrink-0" />}
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-muted">Group by</span>
        <select className="input w-auto h-9" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="none">None</option><option value="status">Status</option>
          <option value="assignee">Assignee</option><option value="priority">Priority</option>
        </select>
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            {g.label && <p className="text-xs font-semibold uppercase tracking-wider text-faint px-1 mb-1.5">{g.label} · {g.items.length}</p>}
            <div className="card divide-y divide-line">{g.items.map(Row)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarView({ tasks, milestones, byId, onOpen, onAddOnDay }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  const tasksOn = (d) => tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), d))
  const msOn = (d) => milestones.filter((m) => m.due_date && isSameDay(parseISO(m.due_date), d))

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">{format(month, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button onClick={() => setMonth(addMonths(month, -1))} className="btn btn-soft h-8 w-8 px-0">‹</button>
          <button onClick={() => setMonth(startOfMonth(new Date()))} className="btn btn-soft h-8 px-3 text-xs">Today</button>
          <button onClick={() => setMonth(addMonths(month, 1))} className="btn btn-soft h-8 w-8 px-0">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[11px] text-faint mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = isSameMonth(d, month)
          const ts = tasksOn(d), ms = msOn(d)
          return (
            <div key={d.toISOString()} onClick={() => onAddOnDay(format(d, 'yyyy-MM-dd'))}
              className={`min-h-[76px] rounded-lg border p-1 cursor-pointer transition-colors ${inMonth ? 'border-line hover:border-line-strong' : 'border-transparent opacity-40'} ${isToday(d) ? 'bg-accent-soft/40 border-accent/40' : ''}`}>
              <div className="text-[11px] text-faint text-right pr-0.5">{format(d, 'd')}</div>
              <div className="space-y-0.5 mt-0.5">
                {ms.map((m) => <div key={m.id} className="text-[10px] px-1 py-0.5 rounded bg-accent text-white truncate">⚑ {m.title}</div>)}
                {ts.slice(0, 3).map((t) => (
                  <div key={t.id} onClick={(e) => { e.stopPropagation(); onOpen(t) }}
                    className="text-[10px] px-1 py-0.5 rounded bg-canvas border border-line truncate flex items-center gap-1 hover:border-line-strong">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: PRIORITY[t.priority || 'med'].dot }} />
                    <span className={`truncate ${t.status === 'done' ? 'line-through text-faint' : ''}`}>{t.title}</span>
                  </div>
                ))}
                {ts.length > 3 && <div className="text-[10px] text-faint px-1">+{ts.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskModal({ task, profiles, user, allLabels, allTasks = [], defaultDue, onClose, onDelete }) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [assignee, setAssignee] = useState(task?.assignee || '')
  const [dueDate, setDueDate] = useState(task?.due_date || defaultDue || '')
  const [status, setStatus] = useState(task?.status || 'todo')
  const [priority, setPriority] = useState(task?.priority || 'med')
  const [labels, setLabels] = useState(task?.labels || [])
  const [subtasks, setSubtasks] = useState(task?.subtasks || [])
  const [depends, setDepends] = useState(task?.depends_on || [])
  const [labelInput, setLabelInput] = useState('')
  const [subInput, setSubInput] = useState('')
  const [links, setLinks] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) getLinksFrom('task', task.id).then((rows) => setLinks(rows.map((r) => ({ to_type: r.to_type, to_id: r.to_id }))))
  }, [task])

  function addLabel(e) { e.preventDefault(); const v = labelInput.trim(); if (v && !labels.includes(v)) setLabels([...labels, v]); setLabelInput('') }
  function addSub(e) { e.preventDefault(); const v = subInput.trim(); if (v) setSubtasks([...subtasks, { text: v, done: false }]); setSubInput('') }
  function toggleSub(i) { setSubtasks(subtasks.map((s, idx) => idx === i ? { ...s, done: !s.done } : s)) }

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const payload = { title: title.trim(), description: description.trim() || null, assignee: assignee || null,
      due_date: dueDate || null, status, priority, labels, subtasks, depends_on: depends }
    let taskId = task?.id
    if (task) await supabase.from('tasks').update(payload).eq('id', task.id)
    else {
      const { data } = await supabase.from('tasks').insert({ ...payload, created_by: user.id }).select().single()
      if (data) { taskId = data.id; logActivity({ verb: 'added', entity_type: 'task', entity_id: data.id, summary: `added a task: ${data.title}`, meta: { title: data.title } }) }
    }
    if (taskId) await syncLinks('task', taskId, links, user.id)
    if (assignee && assignee !== user.id && assignee !== task?.assignee) {
      const meName = profiles.find((p) => p.id === user.id)?.display_name || 'Someone'
      await notify({ userIds: [assignee], actor: user.id, type: 'assigned', body: `${meName} assigned you: ${title.trim()}`, link: `/tasks?open=${taskId}` })
    }
    setSaving(false); onClose()
  }

  return (
    <Modal open onClose={onClose} title={task ? 'Edit task' : 'New task'} maxWidth="max-w-lg"
      footer={<>{task && <button onClick={() => onDelete(task)} className="btn btn-ghost mr-auto text-accent border-accent-soft"><Icon name="trash" size={15} /> Delete</button>}
        <button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="space-y-4">
        <div><label className="label">Title</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" /></div>
        <div><label className="label">Notes</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" /></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Assignee</label>
            <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select></div>
          <div className="min-w-0"><label className="label">Due date</label>
            <input className="input min-w-0" type="date" min={todayISO()} value={dueDate || ''}
              onChange={(e) => { const v = e.target.value; setDueDate(v && v < todayISO() ? todayISO() : v) }} /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Priority</label>
            <div className="flex gap-1.5">
              {Object.entries(PRIORITY).map(([k, v]) => (
                <button key={k} onClick={() => setPriority(k)} className={`btn flex-1 h-9 px-0 text-xs ${priority === k ? 'btn-primary' : 'btn-soft'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: v.dot }} /> {v.label}
                </button>
              ))}
            </div></div>
          <div><label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select></div>
        </div>

        {/* Labels */}
        <div><label className="label">Labels</label>
          <div className={`flex flex-wrap gap-1.5 ${labels.length ? 'mb-2' : ''}`}>
            {labels.map((l) => (
              <span key={l} className="chip h-6 px-2 bg-canvas border border-line text-muted">
                <Icon name="tag" size={11} /> {l}
                <button onClick={() => setLabels(labels.filter((x) => x !== l))} className="text-faint hover:text-accent"><Icon name="close" size={11} /></button>
              </span>
            ))}
          </div>
          <form onSubmit={addLabel} className="flex gap-2">
            <input className="input h-9 text-sm" list="labelopts" placeholder="Add a label…" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
            <datalist id="labelopts">{allLabels.map((l) => <option key={l} value={l} />)}</datalist>
            <button className="btn btn-soft h-9 px-3 shrink-0" disabled={!labelInput.trim()}><Icon name="plus" size={15} /></button>
          </form>
        </div>

        {/* Subtasks */}
        <div><label className="label">Checklist {subtasks.length > 0 && <span className="text-faint">· {subtasks.filter((s) => s.done).length}/{subtasks.length}</span>}</label>
          <div className={`space-y-1.5 ${subtasks.length ? 'mb-2' : ''}`}>
            {subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <button onClick={() => toggleSub(i)} className={`h-5 w-5 rounded-md border grid place-items-center shrink-0 ${s.done ? 'bg-accent border-accent text-white' : 'border-line-strong'}`}>
                  {s.done && <Icon name="check" size={13} />}
                </button>
                <span className={`text-sm flex-1 ${s.done ? 'line-through text-faint' : ''}`}>{s.text}</span>
                <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent"><Icon name="close" size={13} /></button>
              </div>
            ))}
          </div>
          <form onSubmit={addSub} className="flex gap-2">
            <input className="input h-9 text-sm" placeholder="Add a checklist item…" value={subInput} onChange={(e) => setSubInput(e.target.value)} />
            <button className="btn btn-soft h-9 px-3 shrink-0" disabled={!subInput.trim()}><Icon name="plus" size={15} /></button>
          </form>
        </div>

        {/* Blocked by */}
        {allTasks.length > 0 && (
          <div><label className="label">Blocked by</label>
            <div className={`flex flex-wrap gap-1.5 ${depends.length ? 'mb-2' : ''}`}>
              {depends.map((id) => {
                const dt = allTasks.find((t) => t.id === id)
                if (!dt) return null
                return (
                  <span key={id} className="chip h-6 px-2 bg-canvas border border-line text-muted">
                    <Icon name="clock" size={11} /> {dt.title}
                    <button onClick={() => setDepends(depends.filter((x) => x !== id))} className="text-faint hover:text-accent"><Icon name="close" size={11} /></button>
                  </span>
                )
              })}
            </div>
            <select className="input h-9 text-sm" value="" onChange={(e) => { if (e.target.value) setDepends([...new Set([...depends, e.target.value])]) }}>
              <option value="">Add a blocking task…</option>
              {allTasks.filter((t) => t.id !== task?.id && !depends.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        {/* Links */}
        <div><label className="label">Related to</label>
          <LinkEditor value={links} onChange={setLinks} />
        </div>
      </div>
    </Modal>
  )
}
