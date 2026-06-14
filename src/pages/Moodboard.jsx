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
                  className="block hover:bg-accent-soft/30 transition-colors">
                  {it.preview_image && <img src={it.preview_image} alt="" className="w-full block" loading="lazy" />}
                  <div className="p-4">
                    <p className="text-sm font-medium break-words line-clamp-2 flex items-start gap-1.5">
                      <Icon name="link" size={14} className="text-accent mt-0.5 shrink-0" />
                      {it.title || it.url}
                    </p>
                    {it.title && <p className="text-xs text-faint truncate mt-1">{(() => { try { return new URL(it.url).hostname } catch { return it.url } })()}</p>}
                  </div>
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
  const [uq, setUq] = useState('')
  const [uresults, setUresults] = useState([])
  const [uloading, setUloading] = useState(false)
  const inputRef = useRef()
  const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY
  const hasUnsplash = !!UNSPLASH_KEY

  useEffect(() => {
    if (tab !== 'unsplash' || !uq.trim()) { setUresults([]); return }
    let cancel = false
    setUloading(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.unsplash.com/search/photos?per_page=12&query=${encodeURIComponent(uq)}`,
          { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
        const j = await r.json()
        if (!cancel) setUresults(j.results || [])
      } catch (e) { if (!cancel) setUresults([]) }
      finally { if (!cancel) setUloading(false) }
    }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [uq, tab])

  async function addUnsplash(photo) {
    setBusy(true); setErr('')
    try {
      const { data } = await supabase.from('moodboard_items').insert({
        type: 'image', url: photo.urls.regular, caption: caption.trim() || `Photo: ${photo.user?.name} / Unsplash`, created_by: user.id,
      }).select().single()
      logActivity({ verb: 'added', entity_type: 'moodboard', entity_id: data?.id, summary: 'pinned to the mood board', meta: { thumb_url: photo.urls.small } })
      onDone()
    } catch (e) { setErr(e.message); setBusy(false) }
  }

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
        let title = null, preview = null
        try {
          const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url.trim())}`)
          const j = await r.json()
          if (j?.status === 'success') { title = j.data?.title || null; preview = j.data?.image?.url || j.data?.logo?.url || null }
        } catch (e) { /* preview is best-effort */ }
        thumb = preview
        const { data } = await supabase.from('moodboard_items').insert({ type: 'link', url: url.trim(), title, preview_image: preview, caption: caption.trim() || null, created_by: user.id }).select().single()
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
        {tab !== 'unsplash' && <button onClick={submit} className="btn btn-primary" disabled={!canSubmit || busy}>{busy ? 'Adding…' : 'Add'}</button>}
      </>}>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('image')} className={`btn flex-1 ${tab === 'image' ? 'btn-primary' : 'btn-soft'}`}><Icon name="image" size={16} /> Image</button>
        <button onClick={() => setTab('link')} className={`btn flex-1 ${tab === 'link' ? 'btn-primary' : 'btn-soft'}`}><Icon name="link" size={16} /> Link</button>
        {hasUnsplash && <button onClick={() => setTab('unsplash')} className={`btn flex-1 ${tab === 'unsplash' ? 'btn-primary' : 'btn-soft'}`}><Icon name="search" size={16} /> Unsplash</button>}
      </div>

      {tab === 'image' && (
        <>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full border border-dashed border-line-strong rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
            <Icon name="upload" size={22} />
            <span className="text-sm">{fileObj ? fileObj.name : 'Click to choose an image'}</span>
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFileObj(e.target.files?.[0] || null)} />
        </>
      )}
      {tab === 'link' && (
        <div>
          <label className="label">URL</label>
          <input className="input" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="text-xs text-faint mt-1">We'll fetch a title and preview image automatically.</p>
        </div>
      )}
      {tab === 'unsplash' && (
        <div>
          <input className="input" autoFocus placeholder="Search Unsplash — e.g. linen texture, streetwear…" value={uq} onChange={(e) => setUq(e.target.value)} />
          <div className="grid grid-cols-3 gap-2 mt-3 max-h-72 overflow-y-auto">
            {uloading && <p className="col-span-3 text-sm text-faint text-center py-6">Searching…</p>}
            {!uloading && uresults.map((p) => (
              <button key={p.id} onClick={() => addUnsplash(p)} disabled={busy}
                className="aspect-square rounded-lg overflow-hidden border border-line hover:border-accent">
                <img src={p.urls.thumb} alt={p.alt_description || ''} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
            {!uloading && uq.trim() && uresults.length === 0 && <p className="col-span-3 text-sm text-faint text-center py-6">No photos found.</p>}
          </div>
        </div>
      )}

      {tab !== 'unsplash' && (
        <div className="mt-4">
          <label className="label">Caption (optional)</label>
          <input className="input" placeholder="Why it inspires you…" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
      )}
      {err && <p className="text-sm text-accent mt-3">{err}</p>}
    </Modal>
  )
}
