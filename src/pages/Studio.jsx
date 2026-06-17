import { useEffect, useState, useCallback } from 'react'
import { supabase, logActivity, uploadFromUrl } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { PageHeader } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { MODELS, SIZES, MODEL_GROUPS, modelById } from '../lib/models.js'

const TYPES = [
  { key: 'logo', label: 'Logo', wrap: (p) => `${p}, minimalist logo design, vector, clean lines, centered, solid white background, high contrast` },
  { key: 'print', label: 'Graphic print', wrap: (p) => `${p}, bold graphic t-shirt print design, high detail, isolated on white background` },
  { key: 'pattern', label: 'Textile pattern', wrap: (p) => `seamless repeating textile pattern, ${p}, flat vector, tileable` },
  { key: 'mood', label: 'Mood image', wrap: (p) => `${p}, editorial fashion photography, cinematic, moodboard aesthetic` },
  { key: 'mockup', label: 'Tee mockup', wrap: (p) => `${p} printed on a plain folded t-shirt, clean product mockup photo, studio lighting` },
  { key: 'custom', label: 'Custom', wrap: (p) => p },
]

function genUrl(prompt, modelId, seed, tune) {
  const m = modelById(modelId)
  const q = new URLSearchParams({ provider: m.provider, model: m.model, prompt, seed: String(seed) })
  if (tune.negative && !m.distilled) q.set('negative', tune.negative)
  if (tune.steps) q.set('steps', String(tune.steps))
  if (tune.guidance && !m.distilled) q.set('guidance', String(tune.guidance))
  if (tune.size && !m.sizeLocked) { const [w, h] = tune.size.split('x'); q.set('width', w); q.set('height', h) }
  return `/api/generate?${q.toString()}`
}

export default function Studio() {
  const { user, can } = useAuth()
  const canGenerate = can('studio', 'generate')
  const canSaveMood = can('mood', 'add')
  const canSaveArena = can('arena', 'create')
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState('logo')
  const [modelId, setModelId] = useState(MODELS[0].id)
  const [count, setCount] = useState(4)
  const [results, setResults] = useState([])
  const [boards, setBoards] = useState([])
  const [arenas, setArenas] = useState([])
  const [boardId, setBoardId] = useState('')
  const [arenaId, setArenaId] = useState('')
  const [saved, setSaved] = useState({})
  const [usage, setUsage] = useState(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [zoom, setZoom] = useState(null)
  // tuning
  const [advanced, setAdvanced] = useState(false)
  const [negative, setNegative] = useState('')
  const [steps, setSteps] = useState('')
  const [guidance, setGuidance] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [seedLock, setSeedLock] = useState('')

  const m = modelById(modelId)
  const tune = { negative, steps, guidance, size }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('studio_last')
      if (!raw) return
      const s = JSON.parse(raw)
      if (s?.prompt && s?.seeds?.length) {
        setPrompt(s.prompt); setType(s.type || 'logo'); setModelId(s.modelId || MODELS[0].id)
        const wrapped = (TYPES.find((t) => t.key === (s.type || 'logo')) || TYPES[0]).wrap(s.prompt)
        setResults(s.seeds.map((seed) => ({ seed, url: genUrl(wrapped, s.modelId || MODELS[0].id, seed, s.tune || {}), loaded: false, error: false })))
      }
    } catch (e) {}
  }, [])

  const load = useCallback(async () => {
    const [b, a] = await Promise.all([
      supabase.from('boards').select('id,name').order('created_at'),
      supabase.from('arenas').select('id,title').order('created_at', { ascending: false }),
    ])
    setBoards(b.data || []); setArenas(a.data || [])
    if (a.data?.[0]) setArenaId(a.data[0].id)
    try { const r = await fetch('/api/usage'); if (r.ok) setUsage(await r.json()) } catch (e) {}
  }, [])
  useEffect(() => { load() }, [load])

  function generate(e) {
    e?.preventDefault()
    if (!prompt.trim() || !canGenerate) return
    setSaved({})
    const wrapped = TYPES.find((t) => t.key === type).wrap(prompt.trim())
    const base = seedLock ? Number(seedLock) : Math.floor(Math.random() * 1e6)
    const seeds = Array.from({ length: count }, (_, i) => seedLock ? base + i : Math.floor(Math.random() * 1e6))
    setResults(seeds.map((seed) => ({ seed, url: genUrl(wrapped, modelId, seed, tune), loaded: false, error: false })))
    try { localStorage.setItem('studio_last', JSON.stringify({ prompt: prompt.trim(), type, modelId, seeds, tune })) } catch (e) {}
    fetch('/api/usage').then((r) => r.ok && r.json().then(setUsage)).catch(() => {})
  }

  async function persist(item, kind) {
    setSaved((s) => ({ ...s, [item.seed]: 'saving' }))
    try {
      const { url } = await uploadFromUrl('brand', item.url, 'studio')
      if (kind === 'mood') {
        const { data } = await supabase.from('moodboard_items').insert({ type: 'image', url, board_id: boardId || null, caption: prompt.trim(), title: `AI: ${prompt.trim()}`, created_by: user.id }).select().single()
        logActivity({ verb: 'added', entity_type: 'moodboard', entity_id: data?.id, summary: 'generated an image in the Studio', meta: { thumb_url: url } })
        setSaved((s) => ({ ...s, [item.seed]: 'mood' }))
      } else {
        let aId = arenaId
        if (!aId) { const { data } = await supabase.from('arenas').insert({ title: prompt.trim() || 'Logo options', created_by: user.id }).select().single(); aId = data?.id; setArenas((c) => [{ id: aId, title: prompt.trim() }, ...c]); setArenaId(aId) }
        await supabase.from('arena_candidates').insert({ arena_id: aId, label: 'AI concept', rationale: prompt.trim(), image_url: url, created_by: user.id })
        logActivity({ verb: 'added', entity_type: 'arena', entity_id: aId, summary: 'added an AI concept to an arena', meta: { thumb_url: url } })
        setSaved((s) => ({ ...s, [item.seed]: 'arena' }))
      }
    } catch (e) { setSaved((s) => ({ ...s, [item.seed]: false })); alert('Save failed: ' + e.message) }
  }

  const usageLine = () => {
    if (m.provider === 'hf') {
      return usage?.hf ? 'Hugging Face · free serverless (rate-limited, no live balance)' : '⚠ Hugging Face token not added yet'
    }
    if (!usage) return 'Checking quota…'
    if (usage.configured === false) return '⚠ Cloudflare key not added yet'
    return `${(usage.used || 0).toLocaleString()} / ${usage.limit.toLocaleString()} neurons used today (delayed)`
  }

  return (
    <div>
      <PageHeader title="Design Studio" subtitle="Multi-model image generation — describe it, tune it, generate it." />

      {!canGenerate && (
        <div className="card p-3 mb-4 flex items-center gap-2 text-sm text-muted">
          <Icon name="lock" size={15} className="text-faint" /> You have view-only access to the Design Studio.
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)} className={`chip h-8 px-3 border ${type === t.key ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={generate}>
          <textarea className="input min-h-[60px] py-2.5 leading-relaxed" rows={type === 'custom' ? 4 : 2} autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={type === 'custom' ? 'Write a full, detailed prompt — subject, style, colours, composition, mood, lighting…' : type === 'logo' ? 'e.g. coastal streetwear wordmark, wave motif, sand tones' : 'describe what you want to see…'} />
          <div className="flex items-end justify-between gap-3 mt-2">
            <p className="text-[11px] text-faint line-clamp-2 flex-1">{!prompt.trim() ? '' : type === 'custom' ? 'Sent exactly as written.' : `Sends → ${TYPES.find((t) => t.key === type).wrap(prompt.trim())}`}</p>
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <select className="input h-10 w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                image{count > 1 ? 's' : ''}
              </label>
              <button className="btn btn-primary" disabled={!prompt.trim() || !canGenerate}><Icon name="wand" size={16} /> Generate</button>
            </div>
          </div>
        </form>

        {/* Model + tuning */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-line text-xs">
          <label className="flex items-center gap-1.5 text-muted">Model
            <select className="input h-8 w-auto text-xs max-w-[200px]" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {MODEL_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {MODELS.filter((mm) => mm.group === g).map((mm) => <option key={mm.id} value={mm.id}>{mm.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-muted hover:text-ink flex items-center gap-1">
            <Icon name="settings" size={13} /> {advanced ? 'Hide' : 'Tune'}
          </button>
          <span className="text-faint italic basis-full sm:basis-auto">{m.desc}</span>
          <span className="text-faint sm:ml-auto basis-full sm:basis-auto sm:text-right">{usageLine()}{sessionCount > 0 ? ` · ${sessionCount} this session` : ''}</span>
        </div>

        {advanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-line animate-in">
            <div className="sm:col-span-2">
              <label className="label">Negative prompt {m.distilled && <span className="text-faint">(ignored by this model)</span>}</label>
              <input className="input h-9 text-sm" disabled={m.distilled} value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="things to avoid — e.g. text, watermark, blurry" />
            </div>
            <div>
              <label className="label">Steps <span className="text-faint">(blank = auto, max {m.maxSteps})</span></label>
              <input className="input h-9 text-sm" type="number" min={1} max={m.maxSteps} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="auto" />
            </div>
            <div>
              <label className="label">Guidance {m.distilled && <span className="text-faint">(ignored)</span>}</label>
              <input className="input h-9 text-sm" type="number" step="0.5" disabled={m.distilled} value={guidance} onChange={(e) => setGuidance(e.target.value)} placeholder="auto" />
            </div>
            <div>
              <label className="label">Aspect {m.sizeLocked && <span className="text-faint">(fixed)</span>}</label>
              <select className="input h-9 text-sm" disabled={m.sizeLocked} value={size} onChange={(e) => setSize(e.target.value)}>{SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            </div>
            <div>
              <label className="label">Seed <span className="text-faint">(blank = random each)</span></label>
              <input className="input h-9 text-sm" type="number" value={seedLock} onChange={(e) => setSeedLock(e.target.value)} placeholder="random" />
            </div>
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 text-faint">
          <div className="h-14 w-14 rounded-2xl bg-accent-soft text-accent grid place-items-center mx-auto mb-4"><Icon name="wand" size={26} /></div>
          <p className="text-sm max-w-sm mx-auto">Pick a model, describe what you want, tune it, and generate. Send the keepers to your Logo Arena or a mood board.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
            <span className="text-muted">Save to board:</span>
            <select className="input w-auto h-9" value={boardId} onChange={(e) => setBoardId(e.target.value)}><option value="">Mood (no board)</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <span className="text-muted ml-2">Arena:</span>
            <select className="input w-auto h-9" value={arenaId} onChange={(e) => setArenaId(e.target.value)}><option value="">+ New arena</option>{arenas.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {results.map((item) => (
              <div key={item.seed} className="card overflow-hidden group">
                <div className="relative bg-canvas aspect-square grid place-items-center">
                  {!item.loaded && !item.error && <div className="absolute inset-0 grid place-items-center"><div className="h-6 w-6 rounded-full border-2 border-line-strong border-t-accent animate-spin" /></div>}
                  {item.error ? (
                    <div className="text-center p-3 text-xs text-faint"><Icon name="close" size={20} className="mx-auto mb-1 text-accent" /> Couldn't generate</div>
                  ) : (
                    <>
                      <img src={item.url} alt="" className={`w-full h-full object-cover ${item.loaded ? '' : 'opacity-0'}`}
                        onLoad={() => { setResults((r) => r.map((x) => x.seed === item.seed ? { ...x, loaded: true } : x)); setSessionCount((c) => c + 1) }}
                        onError={() => setResults((r) => r.map((x) => x.seed === item.seed ? { ...x, error: true } : x))} />
                      {item.loaded && <button onClick={() => setZoom(item.url)} title="Maximise" className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/55 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="search" size={14} /></button>}
                    </>
                  )}
                </div>
                {!item.error && (
                  <div className="p-2 flex gap-1.5">
                    {canSaveMood && <button onClick={() => persist(item, 'mood')} disabled={saved[item.seed]} className="btn btn-soft h-8 flex-1 text-xs">{saved[item.seed] === 'mood' ? '✓ Saved' : saved[item.seed] === 'saving' ? '…' : <><Icon name="mood" size={13} /> Mood</>}</button>}
                    {canSaveArena && <button onClick={() => persist(item, 'arena')} disabled={saved[item.seed]} className="btn btn-soft h-8 flex-1 text-xs text-accent">{saved[item.seed] === 'arena' ? '✓ Sent' : saved[item.seed] === 'saving' ? '…' : <><Icon name="trophy" size={13} /> Arena</>}</button>}
                    <a href={item.url} target="_blank" rel="noreferrer" download className="btn btn-soft h-8 px-2 text-xs"><Icon name="download" size={13} /></a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <img src={zoom} alt="" className="relative max-h-[90vh] max-w-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setZoom(null)} className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/15 text-white grid place-items-center hover:bg-white/25"><Icon name="close" size={18} /></button>
        </div>
      )}
    </div>
  )
}
