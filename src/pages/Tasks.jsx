import { useEffect, useState, useCallback } from 'react'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { prettyDate } from '../lib/util.js'

const COLUMNS = [
  { key: 'todo', label: 'To-do' },
  { key: 'doing', label: 'In progress' },
  { key: 'done', label: 'Done' },
]
const ORDER = ['todo', 'doing', 'done']

export default function Tasks() {
  const { user, profiles } = useAuth()
  const [tasks, setTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // task object or 'new'
  const [msTitle, setMsTitle] = useState('')
  const [msDate, setMsDate] = useState('')
  const byId = (id) => profiles.find((p) => p.id === id)

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from('tasks').select('*').order('position', { ascending: true }).order('created_at'),
      supabase.from('milestones').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    ])
    setTasks(t.data || [])
    setMilestones(m.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function move(task, dir) {
    const idx = ORDER.indexOf(task.status)
    const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, idx + dir))]
    if (next === task.status) return
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
    if (next === 'done') logActivity({ verb: 'completed', entity_type: 'task', entity_id: task.id, summary: `completed a task: ${task.title}` })
  }

  async function remove(task) {
    await supabase.from('tasks').delete().eq('id', task.id)
    setEditing(null); load()
  }

  async function addMilestone(e) {
    e.preventDefault()
    if (!msTitle.trim()) return
    await supabase.from('milestones').insert({ title: msTitle.trim(), due_date: msDate || null, created_by: user.id })
    setMsTitle(''); setMsDate('')
  }
  async function toggleMilestone(m) {
    await supabase.from('milestones').update({ done: !m.done }).eq('id', m.id)
  }
  async function deleteMilestone(m) {
    await supabase.from('milestones').delete().eq('id', m.id)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Tasks & timeline" subtitle="Who's on what, and what's due next."
        action={<button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> New task</button>} />

      {/* Milestones */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="flag" size={16} className="text-accent" />
          <h2 className="font-display text-base">Milestones</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {milestones.length === 0 && <p className="text-sm text-faint">No milestones yet — add your launch target below.</p>}
          {milestones.map((m) => (
            <div key={m.id}
              className={`group chip h-8 px-3 border ${m.done ? 'border-line bg-canvas text-faint line-through' : 'border-line-strong'}`}>
              <button onClick={() => toggleMilestone(m)} className="flex items-center gap-1.5">
                <Icon name={m.done ? 'check' : 'flag'} size={13} className={m.done ? 'text-accent' : 'text-faint'} />
                {m.title}
                {m.due_date && <span className="text-faint font-normal">· {prettyDate(m.due_date)}</span>}
              </button>
              <button onClick={() => deleteMilestone(m)} className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent">
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addMilestone} className="flex flex-col sm:flex-row gap-2">
          <input className="input sm:flex-1" placeholder="Milestone (e.g. Launch drop 01)" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
          <input className="input sm:w-44" type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} />
          <button className="btn btn-soft shrink-0" disabled={!msTitle.trim()}><Icon name="plus" size={16} /> Add</button>
        </form>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const list = tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="flex flex-col">
              <div className="flex items-center justify-between px-1 mb-2.5">
                <h3 className="text-sm font-semibold text-muted">{col.label}</h3>
                <span className="text-xs text-faint bg-canvas border border-line rounded-full px-2 py-0.5">{list.length}</span>
              </div>
              <div className="space-y-2.5 min-h-[60px]">
                {list.map((t) => {
                  const a = byId(t.assignee)
                  const idx = ORDER.indexOf(t.status)
                  return (
                    <div key={t.id} className="card p-3 group hover:border-line-strong transition-colors">
                      <button onClick={() => setEditing(t)} className="text-left w-full">
                        <p className={`text-sm font-medium leading-snug ${t.status === 'done' ? 'line-through text-faint' : ''}`}>{t.title}</p>
                        {t.description && <p className="text-xs text-muted mt-1 line-clamp-2">{t.description}</p>}
                      </button>
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center gap-2">
                          {a ? <Avatar profile={a} size={22} /> : <span className="text-[11px] text-faint">Unassigned</span>}
                          {t.due_date && (
                            <span className="chip h-5 px-1.5 bg-canvas border border-line text-faint">
                              <Icon name="calendar" size={11} /> {prettyDate(t.due_date)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button disabled={idx === 0} onClick={() => move(t, -1)}
                            className="h-6 w-6 grid place-items-center rounded-md text-faint hover:text-ink hover:bg-canvas disabled:opacity-30">‹</button>
                          <button disabled={idx === 2} onClick={() => move(t, 1)}
                            className="h-6 w-6 grid place-items-center rounded-md text-faint hover:text-ink hover:bg-canvas disabled:opacity-30">›</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {list.length === 0 && <div className="text-xs text-faint text-center py-6 border border-dashed border-line rounded-xl">Empty</div>}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <TaskModal task={editing === 'new' ? null : editing} profiles={profiles} user={user}
          onClose={() => setEditing(null)} onDelete={remove} />
      )}
    </div>
  )
}

function TaskModal({ task, profiles, user, onClose, onDelete }) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [assignee, setAssignee] = useState(task?.assignee || '')
  const [dueDate, setDueDate] = useState(task?.due_date || '')
  const [status, setStatus] = useState(task?.status || 'todo')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const payload = { title: title.trim(), description: description.trim() || null, assignee: assignee || null, due_date: dueDate || null, status }
    if (task) {
      await supabase.from('tasks').update(payload).eq('id', task.id)
    } else {
      const { data } = await supabase.from('tasks').insert({ ...payload, created_by: user.id }).select().single()
      if (data) logActivity({ verb: 'added', entity_type: 'task', entity_id: data.id, summary: `added a task: ${data.title}` })
    }
    setSaving(false); onClose()
  }

  return (
    <Modal open onClose={onClose} title={task ? 'Edit task' : 'New task'}
      footer={<>
        {task && <button onClick={() => onDelete(task)} className="btn btn-ghost mr-auto text-accent border-accent-soft"><Icon name="trash" size={15} /> Delete</button>}
        <button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assignee</label>
            <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Due date</label>
            <input className="input" type="date" value={dueDate || ''} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Status</label>
          <div className="flex gap-2">
            {COLUMNS.map((c) => (
              <button key={c.key} onClick={() => setStatus(c.key)}
                className={`btn flex-1 ${status === c.key ? 'btn-primary' : 'btn-soft'}`}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
