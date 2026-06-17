import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, logActivity, purgeEntity, uploadPublicImage } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Comments } from '../components/Discussion.jsx'
import { LinkedTasks } from '../components/Links.jsx'
import { Icon } from '../lib/icons.jsx'
import { prettyDate } from '../lib/util.js'
import { BIBLE_OPTIONS } from '../lib/bibleOptions.js'
import { differenceInCalendarDays } from 'date-fns'

// Per-garment spec fields (moved here from the Brand Bible — they vary piece to piece).
const SPECS = [
  { key: 'fabric', label: 'Fabric & materials', opts: 'materials', placeholder: 'e.g. 320gsm heavyweight cotton, garment-dyed' },
  { key: 'fit', label: 'Fit & silhouette', opts: 'fit', placeholder: 'e.g. Oversized, drop-shoulder, boxy crop' },
  { key: 'sizes', label: 'Sizes', opts: 'sizing', placeholder: 'e.g. XS–XXL, runs oversized — size down' },
  { key: 'construction', label: 'Quality & construction', opts: 'quality', placeholder: 'e.g. Double-needle stitching, ribbed cuffs, YKK zip' },
]

const STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'sketch', label: 'Sketch' },
  { key: 'sample', label: 'Sample' },
  { key: 'approved', label: 'Approved' },
  { key: 'production', label: 'Production' },
  { key: 'done', label: 'Done' },
]
const STATUS = {
  planning: { label: 'Planning', cls: 'bg-canvas border border-line text-muted' },
  production: { label: 'In production', cls: 'bg-accent-soft text-accent' },
  launched: { label: 'Launched', cls: 'bg-ink text-canvas' },
}

function countdown(date) {
  if (!date) return null
  const d = differenceInCalendarDays(new Date(date), new Date())
  if (d < 0) return { text: `Launched ${Math.abs(d)}d ago`, over: true }
  if (d === 0) return { text: 'Launches today', soon: true }
  return { text: `${d} day${d !== 1 ? 's' : ''} to launch`, soon: d <= 14 }
}

export default function Drops() {
  const { user, can } = useAuth()
  const canCreate = can('drops', 'create')
  const canEdit = can('drops', 'edit')
  const canDelete = can('drops', 'delete')
  const [collections, setCollections] = useState([])
  const [garments, setGarments] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [params, setParams] = useSearchParams()

  const load = useCallback(async () => {
    const [c, g] = await Promise.all([
      supabase.from('collections').select('*').order('created_at', { ascending: false }),
      supabase.from('garments').select('*').order('position').order('created_at'),
    ])
    setCollections(c.data || [])
    setGarments(g.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('drops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'garments' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  useEffect(() => {
    const id = params.get('open')
    if (id && collections.some((c) => c.id === id)) setOpenId(id)
  }, [params, collections])

  function open(id) { setOpenId(id); setParams({ open: id }, { replace: true }) }
  function back() { setOpenId(null); setParams({}, { replace: true }) }

  if (loading) return <Spinner />

  const openCollection = collections.find((c) => c.id === openId)
  if (openCollection) {
    return <CollectionDetail collection={openCollection} garments={garments.filter((g) => g.collection_id === openId)}
      user={user} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} onBack={back} onChange={load} />
  }

  return (
    <div>
      <PageHeader title="Drops" subtitle="Plan collections and the pieces inside them."
        action={canCreate && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New collection</button>} />

      {collections.length === 0 ? (
        <EmptyState icon="drops" title="No collections yet"
          subtitle="A drop is a collection of garments with a launch date. Create one, then add the pieces and move them from idea to production."
          action={canCreate && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Create a collection</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {collections.map((c) => {
            const gs = garments.filter((g) => g.collection_id === c.id)
            const done = gs.filter((g) => g.stage === 'done' || g.stage === 'production').length
            const pct = gs.length ? Math.round((done / gs.length) * 100) : 0
            const cd = countdown(c.launch_date)
            return (
              <button key={c.id} onClick={() => open(c.id)} className="card overflow-hidden text-left hover:border-line-strong transition-colors">
                <div className="h-32 bg-canvas relative">
                  {c.cover_url
                    ? <img src={c.cover_url} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full grid place-items-center text-faint"><Icon name="drops" size={28} /></div>}
                  <span className={`chip absolute top-2 left-2 ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg truncate">{c.name}</h3>
                    {cd && <span className={`text-xs shrink-0 ${cd.over ? 'text-faint' : cd.soon ? 'text-accent font-medium' : 'text-muted'}`}>{cd.text}</span>}
                  </div>
                  {c.theme && <p className="text-sm text-muted mt-0.5 line-clamp-1">{c.theme}</p>}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-faint mb-1">
                      <span>{gs.length} piece{gs.length !== 1 ? 's' : ''}</span><span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {creating && <CollectionModal user={user} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); load().then(() => open(id)) }} />}
    </div>
  )
}

function CollectionModal({ user, collection, onClose, onDone, onChange }) {
  const [name, setName] = useState(collection?.name || '')
  const [theme, setTheme] = useState(collection?.theme || '')
  const [status, setStatus] = useState(collection?.status || 'planning')
  const [launch, setLaunch] = useState(collection?.launch_date || '')
  const [cover, setCover] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef()

  async function save() {
    if (!name.trim()) return
    setBusy(true); setErr('')
    try {
      let coverPatch = {}
      if (cover) {
        const { url, path } = await uploadPublicImage('brand', cover, 'collections')
        coverPatch = { cover_url: url, cover_path: path }
      }
      const payload = { name: name.trim(), theme: theme.trim() || null, status, launch_date: launch || null, ...coverPatch }
      if (collection) {
        const { error } = await supabase.from('collections').update(payload).eq('id', collection.id)
        if (error) throw error
        onChange?.(); onClose()
      } else {
        const { data, error } = await supabase.from('collections').insert({ ...payload, created_by: user.id }).select().single()
        if (error) throw error
        logActivity({ verb: 'created', entity_type: 'collection', entity_id: data.id, summary: `started a collection: ${data.name}`, meta: { thumb_url: data.cover_url } })
        onDone(data.id)
      }
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={collection ? 'Edit collection' : 'New collection'}
      footer={<><button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!name.trim() || busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="space-y-4">
        <div><label className="label">Name</label>
          <input className="input" autoFocus placeholder="e.g. Drop 01 — First Light" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Theme / concept</label>
          <input className="input" placeholder="The story behind this drop" value={theme} onChange={(e) => setTheme(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div><label className="label">Launch date</label>
            <input className="input" type="date" value={launch || ''} onChange={(e) => setLaunch(e.target.value)} /></div>
        </div>
        <div><label className="label">Cover image</label>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-soft w-full">
            <Icon name="image" size={16} /> {cover ? cover.name : (collection?.cover_url ? 'Replace cover' : 'Add cover')}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setCover(e.target.files?.[0] || null)} />
        </div>
        {err && <p className="text-sm text-accent">{err}</p>}
      </div>
    </Modal>
  )
}

function CollectionDetail({ collection, garments, user, canCreate, canEdit, canDelete, onBack, onChange }) {
  const [editing, setEditing] = useState(false)
  const [garment, setGarment] = useState(null) // garment obj or 'new'
  const cd = countdown(collection.launch_date)
  const done = garments.filter((g) => g.stage === 'done' || g.stage === 'production').length
  const pct = garments.length ? Math.round((done / garments.length) * 100) : 0

  async function deleteCollection() {
    if (!confirm('Delete this collection and all its pieces?')) return
    await supabase.from('collections').delete().eq('id', collection.id)
    await purgeEntity('collection', collection.id)
    onBack(); onChange()
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-muted hover:text-ink flex items-center gap-1 mb-4">
        <Icon name="chevronDown" size={16} className="rotate-90" /> All collections
      </button>

      {/* Header */}
      <div className="card overflow-hidden mb-6">
        {collection.cover_url && <img src={collection.cover_url} alt="" className="h-40 w-full object-cover" />}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`chip ${STATUS[collection.status].cls}`}>{STATUS[collection.status].label}</span>
                {cd && <span className={`text-xs ${cd.over ? 'text-faint' : cd.soon ? 'text-accent font-medium' : 'text-muted'}`}>· {cd.text}</span>}
              </div>
              <h1 className="font-display text-2xl">{collection.name}</h1>
              {collection.theme && <p className="text-sm text-muted mt-1 max-w-xl">{collection.theme}</p>}
              {collection.launch_date && <p className="text-xs text-faint mt-1 flex items-center gap-1"><Icon name="calendar" size={12} /> {prettyDate(collection.launch_date)}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              {canEdit && <button onClick={() => setEditing(true)} className="btn btn-soft h-9 px-3"><Icon name="edit" size={15} /></button>}
              {canDelete && <button onClick={deleteCollection} className="btn btn-soft h-9 px-3 text-accent"><Icon name="trash" size={15} /></button>}
            </div>
          </div>
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-xs text-faint mb-1">
              <span>{garments.length} piece{garments.length !== 1 ? 's' : ''}</span><span>{pct}% through production</span>
            </div>
            <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Pieces</h2>
        {canCreate && <button onClick={() => setGarment('new')} className="btn btn-primary h-9"><Icon name="plus" size={16} /> Add piece</button>}
      </div>

      {garments.length === 0 ? (
        <EmptyState icon="tasks" title="No pieces yet" subtitle="Add the garments in this drop and move each from idea to production." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
          {STAGES.map((s) => {
            const list = garments.filter((g) => g.stage === s.key)
            return (
              <div key={s.key} className="w-56 shrink-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-sm font-semibold text-muted">{s.label}</h3>
                  <span className="text-xs text-faint">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((g) => (
                    <button key={g.id} onClick={() => setGarment(g)} className="card p-2.5 w-full text-left hover:border-line-strong transition-colors block">
                      {g.image_url && <img src={g.image_url} alt="" className="h-28 w-full object-cover rounded-lg mb-2" />}
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        {g.category && <span className="text-xs text-faint">{g.category}</span>}
                        {g.price != null && <span className="text-xs text-muted">${g.price}</span>}
                      </div>
                      {(g.fit || g.fabric) && <p className="text-[11px] text-faint truncate mt-0.5">{[g.fit, g.fabric].filter(Boolean).join(' · ')}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Linked tasks */}
      <div className="mt-8">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Icon name="link" size={16} className="text-accent" /> Linked tasks</h2>
        <LinkedTasks toType="collection" toId={collection.id} />
      </div>

      {editing && <CollectionModal collection={collection} user={user} onClose={() => setEditing(false)} onChange={onChange} />}
      {garment && <GarmentModal garment={garment === 'new' ? null : garment} collection={collection} user={user}
        canEdit={canEdit} canDelete={canDelete} onClose={() => setGarment(null)} onChange={onChange} />}
    </div>
  )
}

// A spec input with tap-to-add streetwear suggestions (reuses the Bible option lists).
function SpecField({ cfg, value, onChange }) {
  const options = BIBLE_OPTIONS[cfg.opts] || []
  const has = (o) => value.toLowerCase().includes(o.toLowerCase())
  function append(o) {
    const cur = value.trim()
    if (!cur) return onChange(o)
    if (has(o)) return
    const sep = /[,\n]\s*$/.test(value) ? ' ' : ', '
    onChange(value + sep + o)
  }
  return (
    <div>
      <label className="label">{cfg.label}</label>
      <input className="input" placeholder={cfg.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {options.filter((o) => !has(o)).slice(0, 14).map((o) => (
            <button key={o} type="button" onClick={() => append(o)}
              className="chip h-6 px-2 border border-line text-faint hover:border-accent hover:text-accent transition-colors text-[11px]">
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GarmentModal({ garment, collection, user, canEdit = true, canDelete, onClose, onChange }) {
  const canSave = garment ? canEdit : true
  const [name, setName] = useState(garment?.name || '')
  const [category, setCategory] = useState(garment?.category || '')
  const [stage, setStage] = useState(garment?.stage || 'idea')
  const [price, setPrice] = useState(garment?.price ?? '')
  const [notes, setNotes] = useState(garment?.notes || '')
  const [specs, setSpecs] = useState(() => {
    const o = {}; SPECS.forEach((s) => { o[s.key] = garment?.[s.key] || '' }); return o
  })
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef()
  const setSpec = (k, v) => setSpecs((s) => ({ ...s, [k]: v }))

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      let imgPatch = {}
      if (img) { const { url, path } = await uploadPublicImage('brand', img, 'garments'); imgPatch = { image_url: url, image_path: path } }
      const specPatch = {}
      SPECS.forEach((s) => { specPatch[s.key] = specs[s.key].trim() || null })
      const payload = { name: name.trim(), category: category.trim() || null, stage, price: price === '' ? null : Number(price), notes: notes.trim() || null, ...specPatch, ...imgPatch }
      if (garment) {
        await supabase.from('garments').update(payload).eq('id', garment.id)
      } else {
        const { data } = await supabase.from('garments').insert({ ...payload, collection_id: collection.id, created_by: user.id }).select().single()
        logActivity({ verb: 'added', entity_type: 'garment', entity_id: data.id, summary: `added "${data.name}" to ${collection.name}`, meta: { collection_id: collection.id, thumb_url: data.image_url } })
      }
      onChange(); onClose()
    } finally { setBusy(false) }
  }
  async function remove() {
    await supabase.from('garments').delete().eq('id', garment.id)
    onChange(); onClose()
  }

  return (
    <Modal open onClose={onClose} title={garment ? 'Edit piece' : 'New piece'}
      footer={<>{garment && canDelete && <button onClick={remove} className="btn btn-ghost text-accent border-accent-soft mr-auto"><Icon name="trash" size={15} /> Delete</button>}
        <button onClick={onClose} className="btn btn-soft">{canSave ? 'Cancel' : 'Close'}</button>
        {canSave && <button onClick={save} className="btn btn-primary" disabled={!name.trim() || busy}>{busy ? 'Saving…' : 'Save'}</button>}</>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Name</label>
            <input className="input" autoFocus placeholder="e.g. Boxy tee" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">Category</label>
            <input className="input" placeholder="tee, hoodie…" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Stage</label>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></div>
          <div><label className="label">Target price ($)</label>
            <input className="input" type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        </div>
        {/* Per-piece specs */}
        {SPECS.map((s) => (
          <SpecField key={s.key} cfg={s} value={specs[s.key]} onChange={(v) => setSpec(s.key, v)} />
        ))}

        <div><label className="label">Notes</label>
          <textarea className="input" rows={2} placeholder="Anything else — references, fit notes, to-dos…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div><label className="label">Sketch / photo</label>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-soft w-full">
            <Icon name="image" size={16} /> {img ? img.name : (garment?.image_url ? 'Replace image' : 'Add image')}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImg(e.target.files?.[0] || null)} />
        </div>
        {garment && <div><h3 className="text-sm font-semibold text-muted mb-2">Discussion</h3><Comments entityType="garment" entityId={garment.id} compact /></div>}
      </div>
    </Modal>
  )
}
