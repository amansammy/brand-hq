import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, logActivity, purgeEntity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { extractPalette } from '../lib/color.js'

export default function Moodboard() {
  const { user, can } = useAuth()
  const canAdd = can('mood', 'add')
  const canDelete = can('mood', 'delete')
  const canBrandEdit = can('brand', 'edit')
  const [items, setItems] = useState([])
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeBoard, setActiveBoard] = useState('all')
  const [tagFilter, setTagFilter] = useState(null)
  const [adding, setAdding] = useState(false)
  const [lightbox, setLightbox] = useState(null) // index into filtered
  const [dragOver, setDragOver] = useState(false)
  const [newBoard, setNewBoard] = useState(false)

  const load = useCallback(async () => {
    const [it, bd] = await Promise.all([
      supabase.from('moodboard_items').select('*').order('created_at', { ascending: false }),
      supabase.from('boards').select('*').order('created_at'),
    ])
    setItems(it.data || [])
    setBoards(bd.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('mood')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'moodboard_items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  // Paste image from clipboard → upload to current board
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'))
      if (files.length) { e.preventDefault(); uploadFiles(files) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const boardId = activeBoard === 'all' ? null : activeBoard
  const filtered = items.filter((it) =>
    (activeBoard === 'all' || it.board_id === activeBoard) &&
    (!tagFilter || (it.tags || []).includes(tagFilter)))
  const allTags = [...new Set(items.flatMap((it) => it.tags || []))]

  async function uploadFiles(files) {
    if (!canAdd) return
    for (const file of files) {
      try {
        const safe = file.name.replace(/[^\w.\-]+/g, '_')
        const path = `${user.id}/${Date.now()}-${safe}`
        const { error } = await supabase.storage.from('moodboard').upload(path, file)
        if (error) throw error
        const pub = supabase.storage.from('moodboard').getPublicUrl(path).data.publicUrl
        const { data } = await supabase.from('moodboard_items').insert({ type: 'image', url: pub, storage_path: path, board_id: boardId, created_by: user.id }).select().single()
        logActivity({ verb: 'added', entity_type: 'moodboard', entity_id: data?.id, summary: 'pinned to the mood board', meta: { thumb_url: pub } })
      } catch (e) { /* skip */ }
    }
  }

  async function remove(item) {
    if (item.storage_path) await supabase.storage.from('moodboard').remove([item.storage_path])
    await supabase.from('moodboard_items').delete().eq('id', item.id)
    await purgeEntity('moodboard', item.id)
    setLightbox(null); load()
  }
  async function updateTags(item, tags) {
    await supabase.from('moodboard_items').update({ tags }).eq('id', item.id)
    setItems((cur) => cur.map((x) => x.id === item.id ? { ...x, tags } : x))
  }
  async function moveToBoard(item, bId) {
    await supabase.from('moodboard_items').update({ board_id: bId || null }).eq('id', item.id)
    setItems((cur) => cur.map((x) => x.id === item.id ? { ...x, board_id: bId || null } : x))
  }
  async function createBoard(name) {
    if (!name?.trim()) return
    const { data } = await supabase.from('boards').insert({ name: name.trim(), created_by: user.id }).select().single()
    setNewBoard(false); if (data) setActiveBoard(data.id)
  }
  async function addPaletteFromImage(item) {
    try {
      const hexes = await extractPalette(item.url, 5)
      if (!hexes.length) return alert('Could not read colors from this image.')
      await supabase.from('palette_colors').insert(hexes.map((hex) => ({ hex, created_by: user.id })))
      alert(`Added ${hexes.length} colours to your Brand Bible palette.`)
    } catch (e) {
      alert('Color extraction failed (the image may block cross-origin reads). Try an uploaded image.')
    }
  }

  if (loading) return <Spinner />

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = [...e.dataTransfer.files].filter((x) => x.type.startsWith('image/')); if (f.length) uploadFiles(f) }}
    >
      <PageHeader title="Mood board" subtitle="Boards of inspiration — drag, paste, or generate. Pull colors into your palette."
        action={canAdd && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add</button>} />

      {/* Board tabs */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <BoardTab active={activeBoard === 'all'} onClick={() => setActiveBoard('all')}>All</BoardTab>
        {boards.map((b) => <BoardTab key={b.id} active={activeBoard === b.id} onClick={() => setActiveBoard(b.id)}>{b.name}</BoardTab>)}
        {!canAdd ? null : newBoard
          ? <input autoFocus className="input h-8 w-36 text-sm" placeholder="Board name…"
              onKeyDown={(e) => { if (e.key === 'Enter') createBoard(e.target.value); if (e.key === 'Escape') setNewBoard(false) }}
              onBlur={(e) => e.target.value ? createBoard(e.target.value) : setNewBoard(false)} />
          : <button onClick={() => setNewBoard(true)} className="chip h-8 px-3 border border-dashed border-line-strong text-faint hover:text-accent hover:border-accent"><Icon name="plus" size={13} /> Board</button>}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <Icon name="tag" size={14} className="text-faint" />
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
              className={`chip h-6 px-2 border ${tagFilter === t ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}>{t}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="mood" title="Empty board"
          subtitle="Drop or paste images straight in, add links, search Unsplash, or generate art in the Studio. Tip: drag files anywhere here."
          action={canAdd && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add inspiration</button>} />
      ) : (
        <div className="columns-2 sm:columns-3 gap-4 [&>*]:mb-4">
          {filtered.map((it, i) => (
            <div key={it.id} className="card overflow-hidden break-inside-avoid group relative cursor-zoom-in" onClick={() => setLightbox(i)}>
              {it.type === 'image' ? (
                <img src={it.url} alt={it.caption || ''} className="w-full block" loading="lazy" />
              ) : (
                <div className="block">
                  {it.preview_image && <img src={it.preview_image} alt="" className="w-full block" loading="lazy" />}
                  <div className="p-4">
                    <p className="text-sm font-medium break-words line-clamp-2 flex items-start gap-1.5"><Icon name="link" size={14} className="text-accent mt-0.5 shrink-0" />{it.title || it.url}</p>
                  </div>
                </div>
              )}
              {it.caption && it.type === 'image' && <p className="text-sm text-muted px-3 py-2">{it.caption}</p>}
              {(it.tags?.length > 0) && <div className="px-3 pb-2 flex flex-wrap gap-1">{it.tags.map((t) => <span key={t} className="chip h-4 px-1.5 bg-canvas border border-line text-faint text-[10px]">{t}</span>)}</div>}
              {canDelete && <button onClick={(e) => { e.stopPropagation(); remove(it) }}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="trash" size={14} /></button>}
            </div>
          ))}
        </div>
      )}

      {dragOver && (
        <div className="fixed inset-0 z-50 bg-accent/10 border-4 border-dashed border-accent grid place-items-center pointer-events-none">
          <div className="card px-6 py-4 text-accent font-medium">Drop images to add them</div>
        </div>
      )}

      {adding && <AddModal user={user} boardId={boardId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load() }} />}
      {lightbox !== null && filtered[lightbox] && (
        <Lightbox item={filtered[lightbox]} boards={boards} allTags={allTags}
          canAdd={canAdd} canDelete={canDelete} canBrandEdit={canBrandEdit}
          hasPrev={lightbox > 0} hasNext={lightbox < filtered.length - 1}
          onPrev={() => setLightbox(lightbox - 1)} onNext={() => setLightbox(lightbox + 1)}
          onClose={() => setLightbox(null)} onTags={updateTags} onMove={moveToBoard} onPalette={addPaletteFromImage} onDelete={remove} />
      )}
    </div>
  )
}

function BoardTab({ active, onClick, children }) {
  return <button onClick={onClick} className={`chip h-8 px-3 border ${active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-line-strong'}`}>{children}</button>
}

function Lightbox({ item, boards = [], allTags = [], canAdd, canDelete, canBrandEdit, hasPrev, hasNext, onPrev, onNext, onClose, onTags, onMove, onPalette, onDelete }) {
  const [tag, setTag] = useState('')
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft' && hasPrev) onPrev(); if (e.key === 'ArrowRight' && hasNext) onNext() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hasPrev, hasNext, onPrev, onNext, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev() }} className="absolute left-3 z-10 h-10 w-10 rounded-full bg-white/15 text-white grid place-items-center hover:bg-white/25">‹</button>}
      {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext() }} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-white/15 text-white grid place-items-center hover:bg-white/25">›</button>}
      <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 min-h-0 grid place-items-center mb-3">
          {item.type === 'image'
            ? <img src={item.url} alt="" className="max-h-[68vh] max-w-full object-contain rounded-xl" />
            : <a href={item.url} target="_blank" rel="noreferrer" className="card p-6 text-center"><Icon name="link" size={24} className="text-accent mx-auto mb-2" /><p className="text-sm break-words">{item.title || item.url}</p></a>}
        </div>
        <div className="card p-3">
          {item.caption && <p className="text-sm text-muted mb-2">{item.caption}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {(item.tags || []).map((t) => (
              <span key={t} className="chip h-6 px-2 bg-canvas border border-line text-muted">{t}
                {canAdd && <button onClick={() => onTags(item, (item.tags || []).filter((x) => x !== t))} className="text-faint hover:text-accent"><Icon name="close" size={11} /></button>}</span>
            ))}
            {canAdd && <input className="input h-7 w-28 text-xs" placeholder="+ tag" list="mood-tags" value={tag} onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { onTags(item, [...new Set([...(item.tags || []), tag.trim()])]); setTag('') } }} />}
            <datalist id="mood-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAdd && (
            <label className="flex items-center gap-1.5 text-xs text-muted">Board
              <select className="input h-8 w-auto text-xs" value={item.board_id || ''} onChange={(e) => onMove(item, e.target.value)}>
                <option value="">No board</option>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            )}
            {item.type === 'image' && canBrandEdit && <button onClick={() => onPalette(item)} className="btn btn-soft h-8 text-xs"><Icon name="mood" size={14} /> Extract palette</button>}
            <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-soft h-8 text-xs"><Icon name="link" size={14} /> Open</a>
            {canDelete && <button onClick={() => onDelete(item)} className="btn btn-soft h-8 text-xs text-accent ml-auto"><Icon name="trash" size={14} /> Delete</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddModal({ user, boardId, onClose, onDone }) {
  const [tab, setTab] = useState('image')
  const [fileObj, setFileObj] = useState(null)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [uq, setUq] = useState('')
  const [uresults, setUresults] = useState([])
  const [uloading, setUloading] = useState(false)
  const [upage, setUpage] = useState(1)
  const [utotal, setUtotal] = useState(1)
  const gridRef = useRef(null)
  const inputRef = useRef()
  const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY
  const hasUnsplash = !!UNSPLASH_KEY

  useEffect(() => {
    if (tab !== 'unsplash' || !uq.trim()) { setUresults([]); setUtotal(1); return }
    let cancel = false
    setUloading(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.unsplash.com/search/photos?per_page=9&page=${upage}&query=${encodeURIComponent(uq)}`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
        const j = await r.json()
        if (!cancel) { setUresults(j.results || []); setUtotal(j.total_pages || 1); gridRef.current?.scrollTo({ top: 0 }) }
      } catch (e) { if (!cancel) setUresults([]) }
      finally { if (!cancel) setUloading(false) }
    }, 300)
    return () => { cancel = true; clearTimeout(t) }
  }, [uq, tab, upage])

  async function addUnsplash(photo) {
    setBusy(true); setErr('')
    try {
      try { if (photo.links?.download_location) fetch(`${photo.links.download_location}&client_id=${UNSPLASH_KEY}`) } catch (e) {}
      const credit = `Photo by ${photo.user?.name || 'Unsplash'} on Unsplash`
      const { data } = await supabase.from('moodboard_items').insert({ type: 'image', url: photo.urls.regular, title: caption.trim() || credit, caption: caption.trim() ? credit : null, board_id: boardId, created_by: user.id }).select().single()
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
        const { data } = await supabase.from('moodboard_items').insert({ type: 'image', url: pub, storage_path: path, caption: caption.trim() || null, board_id: boardId, created_by: user.id }).select().single()
        row = data
      } else {
        if (!url.trim()) return
        let title = null, preview = null
        try {
          const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url.trim())}`)
          const j = await r.json()
          if (j?.status === 'success') { title = j.data?.title || null; preview = j.data?.image?.url || j.data?.logo?.url || null }
        } catch (e) {}
        thumb = preview
        const { data } = await supabase.from('moodboard_items').insert({ type: 'link', url: url.trim(), title, preview_image: preview, caption: caption.trim() || null, board_id: boardId, created_by: user.id }).select().single()
        row = data
      }
      logActivity({ verb: 'added', entity_type: 'moodboard', entity_id: row?.id, summary: 'pinned to the mood board', meta: { thumb_url: thumb } })
      onDone()
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  const canSubmit = tab === 'image' ? !!fileObj : !!url.trim()

  return (
    <Modal open onClose={onClose} title="Add to mood board"
      footer={<><button onClick={onClose} className="btn btn-soft">Cancel</button>
        {tab !== 'unsplash' && <button onClick={submit} className="btn btn-primary" disabled={!canSubmit || busy}>{busy ? 'Adding…' : 'Add'}</button>}</>}>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('image')} className={`btn flex-1 ${tab === 'image' ? 'btn-primary' : 'btn-soft'}`}><Icon name="image" size={16} /> Image</button>
        <button onClick={() => setTab('link')} className={`btn flex-1 ${tab === 'link' ? 'btn-primary' : 'btn-soft'}`}><Icon name="link" size={16} /> Link</button>
        {hasUnsplash && <button onClick={() => setTab('unsplash')} className={`btn flex-1 ${tab === 'unsplash' ? 'btn-primary' : 'btn-soft'}`}><Icon name="search" size={16} /> Unsplash</button>}
      </div>

      {tab === 'image' && (<>
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full border border-dashed border-line-strong rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
          <Icon name="upload" size={22} /><span className="text-sm">{fileObj ? fileObj.name : 'Click to choose an image'}</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFileObj(e.target.files?.[0] || null)} />
      </>)}
      {tab === 'link' && (
        <div><label className="label">URL</label>
          <input className="input" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="text-xs text-faint mt-1">We'll fetch a title and preview image automatically.</p>
        </div>
      )}
      {tab === 'unsplash' && (
        <div>
          <input className="input" autoFocus placeholder="Search Unsplash — e.g. linen texture, streetwear…" value={uq} onChange={(e) => { setUq(e.target.value); setUpage(1) }} />
          <div ref={gridRef} className="grid grid-cols-3 gap-2 mt-3">
            {uloading && <p className="col-span-3 text-sm text-faint text-center py-6">Searching…</p>}
            {!uloading && uresults.map((p) => (
              <button key={p.id} onClick={() => addUnsplash(p)} disabled={busy} className="aspect-square rounded-lg overflow-hidden border border-line hover:border-accent">
                <img src={p.urls.thumb} alt={p.alt_description || ''} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
            {!uloading && uq.trim() && uresults.length === 0 && <p className="col-span-3 text-sm text-faint text-center py-6">No photos found.</p>}
          </div>
          {uresults.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <button onClick={() => setUpage((p) => Math.max(1, p - 1))} disabled={upage <= 1 || uloading} className="btn btn-soft h-8 px-3 text-xs">‹ Prev</button>
              <span className="text-xs text-faint">Page {upage} of {utotal}</span>
              <button onClick={() => setUpage((p) => Math.min(utotal, p + 1))} disabled={upage >= utotal || uloading} className="btn btn-soft h-8 px-3 text-xs">Next ›</button>
            </div>
          )}
        </div>
      )}

      {tab !== 'unsplash' && (
        <div className="mt-4"><label className="label">Caption (optional)</label>
          <input className="input" placeholder="Why it inspires you…" value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
      )}
      {err && <p className="text-sm text-accent mt-3">{err}</p>}
    </Modal>
  )
}
