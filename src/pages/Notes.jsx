import { useEffect, useState, useCallback } from 'react'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { timeAgo } from '../lib/util.js'

export default function Notes() {
  const { user, profiles } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: 'Someone' }

  const load = useCallback(async () => {
    const { data } = await supabase.from('notes').select('*').order('updated_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function create() {
    const { data } = await supabase.from('notes')
      .insert({ title: 'Untitled', content: '', updated_by: user.id }).select().single()
    if (data) { logActivity({ verb: 'created', entity_type: 'note', entity_id: data.id, summary: 'started a new note' }); load(); setOpen(data) }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Notes" subtitle="Manifesto, brand voice, ideas — your living docs."
        action={<button className="btn btn-primary" onClick={create}><Icon name="plus" size={16} /> New note</button>} />

      {notes.length === 0 ? (
        <EmptyState icon="notes" title="No notes yet"
          subtitle="Draft the manifesto, jot brand voice rules, collect naming ideas — anything you want to write together."
          action={<button className="btn btn-primary" onClick={create}><Icon name="plus" size={16} /> Write a note</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {notes.map((n) => (
            <button key={n.id} onClick={() => setOpen(n)}
              className="card p-5 text-left hover:border-line-strong transition-colors h-44 flex flex-col">
              <h3 className="font-display text-lg mb-1.5 truncate">{n.title || 'Untitled'}</h3>
              <p className="text-sm text-muted whitespace-pre-wrap line-clamp-4 flex-1">{n.content || 'Empty note'}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-faint">
                <Avatar profile={byId(n.updated_by)} size={20} />
                edited {timeAgo(n.updated_at)}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && <NoteEditor note={open} user={user} onClose={() => setOpen(null)} onSaved={load} />}
    </div>
  )
}

function NoteEditor({ note, user, onClose, onSaved }) {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content || '')
  const [saving, setSaving] = useState(false)
  const dirty = title !== (note.title || '') || content !== (note.content || '')

  async function save() {
    setSaving(true)
    await supabase.from('notes').update({ title: title.trim() || 'Untitled', content, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', note.id)
    setSaving(false); onSaved(); onClose()
  }
  async function remove() {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', note.id)
    onSaved(); onClose()
  }

  return (
    <Modal open onClose={onClose} title={note.title ? 'Edit note' : 'New note'} maxWidth="max-w-2xl"
      footer={<>
        <button onClick={remove} className="btn btn-ghost text-accent border-accent-soft mr-auto"><Icon name="trash" size={15} /> Delete</button>
        <button onClick={onClose} className="btn btn-soft">Close</button>
        <button onClick={save} className="btn btn-primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <input className="input text-lg font-display border-0 px-0 focus:ring-0 focus:shadow-none mb-2 h-auto py-1"
        style={{ boxShadow: 'none' }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input min-h-[45vh] leading-relaxed" placeholder="Start writing…"
        value={content} onChange={(e) => setContent(e.target.value)} />
    </Modal>
  )
}
