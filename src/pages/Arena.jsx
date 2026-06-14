import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, logActivity, purgeEntity, uploadPublicImage } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Reactions, Comments } from '../components/Discussion.jsx'
import { Icon } from '../lib/icons.jsx'

export default function Arena() {
  const { user } = useAuth()
  const [arenas, setArenas] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [params, setParams] = useSearchParams()

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([
      supabase.from('arenas').select('*').order('created_at', { ascending: false }),
      supabase.from('arena_candidates').select('*').order('created_at'),
    ])
    setArenas(a.data || [])
    setCandidates(c.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('arena')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arenas' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_candidates' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  useEffect(() => {
    const id = params.get('open')
    if (id && arenas.some((a) => a.id === id)) setOpenId(id)
  }, [params, arenas])

  function open(id) { setOpenId(id); setParams({ open: id }, { replace: true }) }
  function back() { setOpenId(null); setParams({}, { replace: true }) }

  if (loading) return <Spinner />

  const openArena = arenas.find((a) => a.id === openId)
  if (openArena) {
    return <ArenaDetail arena={openArena} candidates={candidates.filter((c) => c.arena_id === openId)}
      user={user} onBack={back} onChange={load} />
  }

  return (
    <div>
      <PageHeader title="Logo arena" subtitle="Upload options, vote, lock the winner."
        action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New arena</button>} />

      {arenas.length === 0 ? (
        <EmptyState icon="trophy" title="No arenas yet"
          subtitle="Create an arena for your logo (or packaging, labels, anything visual). Drop in the options, vote together, and crown a winner."
          action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Create an arena</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {arenas.map((a) => {
            const cs = candidates.filter((c) => c.arena_id === a.id)
            const winner = cs.find((c) => c.is_winner)
            return (
              <button key={a.id} onClick={() => open(a.id)} className="card p-4 text-left hover:border-line-strong transition-colors flex gap-4">
                <div className="h-16 w-16 rounded-xl overflow-hidden border border-line shrink-0 grid place-items-center bg-canvas">
                  {winner?.image_url ? <img src={winner.image_url} alt="" className="h-full w-full object-cover" />
                    : <Icon name="trophy" size={22} className="text-faint" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg truncate">{a.title}</h3>
                  {a.description && <p className="text-sm text-muted line-clamp-1">{a.description}</p>}
                  <p className="text-xs text-faint mt-2">
                    {cs.length} option{cs.length !== 1 ? 's' : ''}{winner ? ' · winner chosen ✓' : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {creating && <ArenaModal user={user} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); load().then(() => open(id)) }} />}
    </div>
  )
}

function ArenaModal({ user, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!title.trim()) return
    setBusy(true); setErr('')
    try {
      const { data, error } = await supabase.from('arenas').insert({ title: title.trim(), description: description.trim() || null, created_by: user.id }).select().single()
      if (error) throw error
      logActivity({ verb: 'created', entity_type: 'arena', entity_id: data.id, summary: `opened an arena: ${data.title}` })
      onDone(data.id)
    } catch (e) { setErr(e.message || String(e)); setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="New arena"
      footer={<><button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!title.trim() || busy}>{busy ? 'Saving…' : 'Create'}</button></>}>
      <div className="space-y-4">
        <div><label className="label">What are you deciding?</label>
          <input className="input" autoFocus placeholder="e.g. Primary logo" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label">Description (optional)</label>
          <input className="input" placeholder="Context for the options" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {err && <p className="text-sm text-accent">{err}</p>}
      </div>
    </Modal>
  )
}

function ArenaDetail({ arena, candidates, user, onBack, onChange }) {
  const [adding, setAdding] = useState(false)

  async function deleteArena() {
    if (!confirm('Delete this arena and all options?')) return
    await supabase.from('arenas').delete().eq('id', arena.id)
    await purgeEntity('arena', arena.id)
    onBack(); onChange()
  }
  async function makeWinner(c) {
    await supabase.from('arena_candidates').update({ is_winner: false }).eq('arena_id', arena.id)
    await supabase.from('arena_candidates').update({ is_winner: true }).eq('id', c.id)
    logActivity({ verb: 'completed', entity_type: 'arena', entity_id: arena.id, summary: `picked a winner in "${arena.title}"`, meta: { thumb_url: c.image_url } })
    onChange()
  }
  async function removeCandidate(c) {
    if (c.image_path) await supabase.storage.from('brand').remove([c.image_path])
    await supabase.from('arena_candidates').delete().eq('id', c.id)
    onChange()
  }

  const sorted = [...candidates].sort((a, b) => (b.is_winner ? 1 : 0) - (a.is_winner ? 1 : 0))

  return (
    <div>
      <button onClick={onBack} className="text-sm text-muted hover:text-ink flex items-center gap-1 mb-4">
        <Icon name="chevronDown" size={16} className="rotate-90" /> All arenas
      </button>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl">{arena.title}</h1>
          {arena.description && <p className="text-sm text-muted mt-1">{arena.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setAdding(true)} className="btn btn-primary h-9"><Icon name="plus" size={16} /> Add option</button>
          <button onClick={deleteArena} className="btn btn-soft h-9 px-3 text-accent"><Icon name="trash" size={15} /></button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <EmptyState icon="image" title="No options yet" subtitle="Upload the candidates you want to choose between." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map((c) => (
            <div key={c.id} className={`card overflow-hidden ${c.is_winner ? 'ring-2 ring-accent' : ''}`}>
              <div className="relative bg-canvas">
                {c.image_url && <img src={c.image_url} alt={c.label || ''} className="w-full max-h-72 object-contain" />}
                {c.is_winner && <span className="chip absolute top-2 left-2 bg-accent text-white"><Icon name="trophy" size={12} /> Winner</span>}
                <button onClick={() => removeCandidate(c)} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-ink/60 text-white grid place-items-center hover:bg-ink/80">
                  <Icon name="trash" size={13} />
                </button>
              </div>
              <div className="p-4">
                {c.label && <p className="font-medium">{c.label}</p>}
                {c.rationale && <p className="text-sm text-muted mt-0.5">{c.rationale}</p>}
                <div className="flex items-center justify-between mt-3">
                  <Reactions entityType="candidate" entityId={c.id} />
                  {!c.is_winner && <button onClick={() => makeWinner(c)} className="btn btn-soft h-8 px-3 text-accent"><Icon name="trophy" size={14} /> Pick winner</button>}
                </div>
                <div className="mt-3 pt-3 border-t border-line">
                  <Comments entityType="candidate" entityId={c.id} compact />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <CandidateModal arena={arena} user={user} onClose={() => setAdding(false)} onChange={onChange} />}
    </div>
  )
}

function CandidateModal({ arena, user, onClose, onChange }) {
  const [label, setLabel] = useState('')
  const [rationale, setRationale] = useState('')
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef()

  async function save() {
    if (!img) return
    setBusy(true); setErr('')
    try {
      const { url, path } = await uploadPublicImage('brand', img, 'arena')
      await supabase.from('arena_candidates').insert({ arena_id: arena.id, label: label.trim() || null, rationale: rationale.trim() || null, image_url: url, image_path: path, created_by: user.id })
      logActivity({ verb: 'added', entity_type: 'arena', entity_id: arena.id, summary: `added an option to "${arena.title}"`, meta: { thumb_url: url } })
      onChange(); onClose()
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Add option"
      footer={<><button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!img || busy}>{busy ? 'Uploading…' : 'Add'}</button></>}>
      <div className="space-y-4">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full border border-dashed border-line-strong rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
          <Icon name="upload" size={22} />
          <span className="text-sm">{img ? img.name : 'Click to choose an image'}</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImg(e.target.files?.[0] || null)} />
        <div><label className="label">Label (optional)</label>
          <input className="input" placeholder="e.g. Option A — wordmark" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><label className="label">Rationale (optional)</label>
          <input className="input" placeholder="Why this one?" value={rationale} onChange={(e) => setRationale(e.target.value)} /></div>
        {err && <p className="text-sm text-accent">{err}</p>}
      </div>
    </Modal>
  )
}
