import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, logActivity, purgeEntity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'

export default function Moodboard() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('moodboard_items').select('*').order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('mood')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'moodboard_items' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function remove(item) {
    if (item.storage_path) await supabase.storage.from('moodboard').remove([item.storage_path])
    await supabase.from('moodboard_items').delete().eq('id', item.id)
    await purgeEntity('moodboard', item.id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Mood board" subtitle="Pin inspiration — images, references, links."
        action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add</button>} />

      {items.length === 0 ? (
        <EmptyState icon="mood" title="Empty board"
          subtitle="Drop in fabric shots, fits you love, color references, links — the visual language of the brand."
          action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add inspiration</button>} />
      ) : (
        <div className="columns-2 sm:columns-3 gap-4 [&>*]:mb-4">
          {items.map((it) => (
            <div key={it.id} className="card overflow-hidden break-inside-avoid group relative">
              {it.type === 'image' ? (
                <img src={it.url} alt={it.caption || ''} className="w-full block" loading="lazy" />
              ) : (
                <a href={it.url} target="_blank" rel="noreferrer"
                  className="block p-5 bg-canvas hover:bg-accent-soft/40 transition-colors">
                  <Icon name="link" size={20} className="text-accent mb-2" />
                  <p className="text-sm font-medium break-words line-clamp-3">{it.url}</p>
                </a>
              )}
              {it.caption && <p className="text-sm text-muted px-3 py-2">{it.caption}</p>}
              <button onClick={() => remove(it)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && <AddModal user={user} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} />}
    </div>
  )
}

function AddModal({ user, onClose, onDone }) {
  const [tab, setTab] = useState('image')
  const [fileObj, setFileObj] = useState(null)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef()

  async function submit() {
    setBusy(true); setErr('')
    try {
      let row, thumb = null
      if (tab === 'image') {
        if (!fileObj) return
        const safe = fileObj.name.replace(/[^\w.\-]+/g, '_')
        const path = `${user.id}/${Date.now()}-${safe}`
        const { error } = await supabase.storage.from('moodboard').upload(path, fileObj)
        if (error) throw error
        const pub = supabase.storage.from('moodboard').getPublicUrl(path).data.publicUrl
        thumb = pub
        const { data } = await supabase.from('moodboard_items').insert({ type: 'image', url: pub, storage_path: path, caption: caption.trim() || null, created_by: user.id }).select().single()
        row = data
      } else {
        if (!url.trim()) return
        const { data } = await supabase.from('moodboard_items').insert({ type: 'link', url: url.trim(), caption: caption.trim() || null, created_by: user.id }).select().single()
        row = data
      }
      logActivity({ verb: 'added', entity_type: 'moodboard', entity_id: row?.id, summary: 'pinned to the mood board', meta: { thumb_url: thumb } })
      onDone()
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  const canSubmit = tab === 'image' ? !!fileObj : !!url.trim()

  return (
    <Modal open onClose={onClose} title="Add to mood board"
      footer={<>
        <button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={submit} className="btn btn-primary" disabled={!canSubmit || busy}>{busy ? 'Adding…' : 'Add'}</button>
      </>}>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('image')} className={`btn flex-1 ${tab === 'image' ? 'btn-primary' : 'btn-soft'}`}><Icon name="image" size={16} /> Image</button>
        <button onClick={() => setTab('link')} className={`btn flex-1 ${tab === 'link' ? 'btn-primary' : 'btn-soft'}`}><Icon name="link" size={16} /> Link</button>
      </div>

      {tab === 'image' ? (
        <>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full border border-dashed border-line-strong rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
            <Icon name="upload" size={22} />
            <span className="text-sm">{fileObj ? fileObj.name : 'Click to choose an image'}</span>
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFileObj(e.target.files?.[0] || null)} />
        </>
      ) : (
        <div>
          <label className="label">URL</label>
          <input className="input" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      )}

      <div className="mt-4">
        <label className="label">Caption (optional)</label>
        <input className="input" placeholder="Why it inspires you…" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      {err && <p className="text-sm text-accent mt-3">{err}</p>}
    </Modal>
  )
}
