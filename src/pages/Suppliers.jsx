import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, logActivity, purgeEntity, uploadPublicImage } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { timeAgo } from '../lib/util.js'

const KINDS = ['manufacturer', 'fabric', 'printer', 'trims', 'other']
const SAMPLE_STATUS = {
  requested: { label: 'Requested', cls: 'bg-canvas border border-line text-muted' },
  received: { label: 'Received', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-accent-soft text-accent' },
  rejected: { label: 'Rejected', cls: 'bg-canvas border border-line text-faint line-through' },
}
const Stars = ({ n }) => <span className="text-accent text-xs">{'★'.repeat(n || 0)}<span className="text-line-strong">{'★'.repeat(5 - (n || 0))}</span></span>

export default function Suppliers() {
  const { user, can } = useAuth()
  const canCreate = can('suppliers', 'create')
  const canEdit = can('suppliers', 'edit')
  const canDelete = can('suppliers', 'delete')
  const [suppliers, setSuppliers] = useState([])
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null) // supplier obj | 'new'
  const [params, setParams] = useSearchParams()

  const load = useCallback(async () => {
    const [s, sa] = await Promise.all([
      supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
      supabase.from('samples').select('*').order('created_at', { ascending: false }),
    ])
    setSuppliers(s.data || [])
    setSamples(sa.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('suppliers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'samples' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  useEffect(() => {
    const id = params.get('open')
    if (id && suppliers.some((s) => s.id === id)) setOpenId(id)
  }, [params, suppliers])

  if (loading) return <Spinner />

  const openSupplier = suppliers.find((s) => s.id === openId)
  if (openSupplier) {
    return <SupplierDetail supplier={openSupplier} samples={samples.filter((x) => x.supplier_id === openId)}
      user={user} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
      onBack={() => { setOpenId(null); setParams({}, { replace: true }) }}
      onEdit={() => setEditing(openSupplier)} onChange={load}
      editing={editing} setEditing={setEditing} />
  }

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Manufacturers, mills, printers — and every sample round."
        action={canCreate && <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> New supplier</button>} />

      {suppliers.length === 0 ? (
        <EmptyState icon="factory" title="No suppliers yet"
          subtitle="Add the manufacturers and fabric mills you're talking to — track MOQ, lead time, quotes, and how each sample round turns out."
          action={canCreate && <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add a supplier</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {suppliers.map((s) => {
            const ss = samples.filter((x) => x.supplier_id === s.id)
            return (
              <button key={s.id} onClick={() => { setOpenId(s.id); setParams({ open: s.id }, { replace: true }) }}
                className="card p-4 text-left hover:border-line-strong transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{s.name}</h3>
                    <span className="chip h-5 px-1.5 bg-canvas border border-line text-faint mt-1">{s.kind}</span>
                  </div>
                  {s.rating ? <Stars n={s.rating} /> : null}
                </div>
                <div className="text-xs text-faint mt-3 space-y-0.5">
                  {s.location && <p className="flex items-center gap-1">📍 {s.location}</p>}
                  {(s.moq || s.lead_time) && <p>{s.moq && `MOQ ${s.moq}`}{s.moq && s.lead_time && ' · '}{s.lead_time && `Lead ${s.lead_time}`}</p>}
                  <p>{ss.length} sample{ss.length !== 1 ? 's' : ''}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {editing && !openId && <SupplierModal supplier={editing === 'new' ? null : editing} user={user}
        canEdit={canEdit} canDelete={canDelete} onClose={() => setEditing(null)} onChange={load} />}
    </div>
  )
}

function SupplierModal({ supplier, user, canEdit = true, canDelete, onClose, onChange }) {
  const canSave = supplier ? canEdit : true
  const [f, setF] = useState({
    name: supplier?.name || '', kind: supplier?.kind || 'manufacturer', contact: supplier?.contact || '',
    location: supplier?.location || '', moq: supplier?.moq || '', lead_time: supplier?.lead_time || '',
    rating: supplier?.rating || 0, url: supplier?.url || '', notes: supplier?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF({ ...f, [k]: v })

  async function save() {
    if (!f.name.trim()) return
    setBusy(true)
    const payload = { ...f, name: f.name.trim(), rating: f.rating || null }
    if (supplier) await supabase.from('suppliers').update(payload).eq('id', supplier.id)
    else {
      const { data } = await supabase.from('suppliers').insert({ ...payload, created_by: user.id }).select().single()
      if (data) logActivity({ verb: 'added', entity_type: 'supplier', entity_id: data.id, summary: `added a supplier: ${data.name}` })
    }
    setBusy(false); onChange(); onClose()
  }
  async function remove() {
    if (!confirm('Delete this supplier?')) return
    await supabase.from('suppliers').delete().eq('id', supplier.id)
    await purgeEntity('supplier', supplier.id)
    onChange(); onClose()
  }

  return (
    <Modal open onClose={onClose} title={supplier ? 'Edit supplier' : 'New supplier'}
      footer={<>{supplier && canDelete && <button onClick={remove} className="btn btn-ghost text-accent border-accent-soft mr-auto"><Icon name="trash" size={15} /> Delete</button>}
        <button onClick={onClose} className="btn btn-soft">{canSave ? 'Cancel' : 'Close'}</button>
        {canSave && <button onClick={save} className="btn btn-primary" disabled={!f.name.trim() || busy}>{busy ? 'Saving…' : 'Save'}</button>}</>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Name</label><input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Tirupur Knits" /></div>
          <div><label className="label">Kind</label><select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Contact</label><input className="input" value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="email / phone / WhatsApp" /></div>
          <div><label className="label">Location</label><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="label">MOQ</label><input className="input" value={f.moq} onChange={(e) => set('moq', e.target.value)} placeholder="100 pcs" /></div>
          <div><label className="label">Lead time</label><input className="input" value={f.lead_time} onChange={(e) => set('lead_time', e.target.value)} placeholder="3 wks" /></div>
          <div><label className="label">Rating</label>
            <div className="flex items-center h-10 gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set('rating', n === f.rating ? 0 : n)} className={n <= f.rating ? 'text-accent' : 'text-line-strong'}>★</button>
              ))}
            </div>
          </div>
        </div>
        <div><label className="label">Website / link</label><input className="input" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></div>
        <div><label className="label">Notes</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
    </Modal>
  )
}

function SupplierDetail({ supplier, samples, user, canCreate, canEdit, canDelete, onBack, onEdit, onChange, editing, setEditing }) {
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <button onClick={onBack} className="text-sm text-muted hover:text-ink flex items-center gap-1 mb-4">
        <Icon name="chevronDown" size={16} className="rotate-90" /> All suppliers
      </button>

      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-2xl">{supplier.name}</h1>
              <span className="chip h-5 px-1.5 bg-canvas border border-line text-faint">{supplier.kind}</span>
            </div>
            {supplier.rating ? <Stars n={supplier.rating} /> : null}
          </div>
          {canEdit && <button onClick={onEdit} className="btn btn-soft h-9 px-3"><Icon name="edit" size={15} /></button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          {supplier.contact && <Field label="Contact" value={supplier.contact} />}
          {supplier.location && <Field label="Location" value={supplier.location} />}
          {supplier.moq && <Field label="MOQ" value={supplier.moq} />}
          {supplier.lead_time && <Field label="Lead time" value={supplier.lead_time} />}
        </div>
        {supplier.url && <a href={supplier.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline inline-flex items-center gap-1 mt-3"><Icon name="link" size={14} /> {supplier.url}</a>}
        {supplier.notes && <p className="text-sm text-muted mt-3 whitespace-pre-wrap">{supplier.notes}</p>}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Samples</h2>
        {canCreate && <button onClick={() => setAdding(true)} className="btn btn-primary h-9"><Icon name="plus" size={16} /> Log sample</button>}
      </div>
      {samples.length === 0 ? (
        <EmptyState icon="files" title="No samples yet" subtitle="Track each sample round — what you asked for, when it landed, and your verdict." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {samples.map((s) => (
            <div key={s.id} className="card overflow-hidden">
              {s.image_url && <img src={s.image_url} alt="" className="w-full max-h-56 object-cover" />}
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{s.title} <span className="text-faint">· R{s.round}</span></p>
                  <span className={`chip ${SAMPLE_STATUS[s.status].cls}`}>{SAMPLE_STATUS[s.status].label}</span>
                </div>
                {s.notes && <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{s.notes}</p>}
                <p className="text-[11px] text-faint mt-2">{timeAgo(s.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <SampleModal supplier={supplier} user={user} onClose={() => setAdding(false)} onChange={onChange} />}
      {editing && editing !== 'new' && <SupplierModal supplier={editing} user={user} canEdit={canEdit} canDelete={canDelete} onClose={() => setEditing(null)} onChange={onChange} />}
    </div>
  )
}

function Field({ label, value }) {
  return <div><p className="text-xs text-faint">{label}</p><p className="font-medium">{value}</p></div>
}

function SampleModal({ supplier, user, onClose, onChange }) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('requested')
  const [round, setRound] = useState(1)
  const [notes, setNotes] = useState('')
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef()

  async function save() {
    if (!title.trim()) return
    setBusy(true)
    let patch = {}
    if (img) { const { url, path } = await uploadPublicImage('brand', img, 'samples'); patch = { image_url: url, image_path: path } }
    const { data } = await supabase.from('samples').insert({
      title: title.trim(), supplier_id: supplier.id, status, round: Number(round) || 1, notes: notes.trim() || null, created_by: user.id, ...patch,
    }).select().single()
    if (data) logActivity({ verb: 'added', entity_type: 'supplier', entity_id: supplier.id, summary: `logged a sample (${status}) from ${supplier.name}`, meta: { thumb_url: patch.image_url } })
    setBusy(false); onChange(); onClose()
  }

  return (
    <Modal open onClose={onClose} title="Log sample"
      footer={<><button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!title.trim() || busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="space-y-4">
        <div><label className="label">What sample</label><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Boxy tee — 240gsm" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(SAMPLE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label className="label">Round</label><input className="input" type="number" min={1} value={round} onChange={(e) => setRound(e.target.value)} /></div>
        </div>
        <div><label className="label">Fit / quality notes</label><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div><label className="label">Photo</label>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-soft w-full"><Icon name="image" size={16} /> {img ? img.name : 'Add photo'}</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImg(e.target.files?.[0] || null)} />
        </div>
      </div>
    </Modal>
  )
}
