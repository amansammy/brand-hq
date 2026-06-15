import { useEffect, useState, useCallback } from 'react'
import { supabase, logActivity, uploadFromUrl } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { PageHeader } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'

const TYPES = [
  { key: 'logo', label: 'Logo', wrap: (p) => `${p}, minimalist logo design, vector, clean lines, centered, solid white background, high contrast` },
  { key: 'print', label: 'Graphic print', wrap: (p) => `${p}, bold graphic t-shirt print design, high detail, isolated on white background` },
  { key: 'pattern', label: 'Textile pattern', wrap: (p) => `seamless repeating textile pattern, ${p}, flat vector, tileable` },
  { key: 'mood', label: 'Mood image', wrap: (p) => `${p}, editorial fashion photography, cinematic, moodboard aesthetic` },
  { key: 'mockup', label: 'Tee mockup', wrap: (p) => `${p} printed on a plain folded t-shirt, clean product mockup photo, studio lighting` },
]

const MODELS = [
  { id: '@cf/black-forest-labs/flux-1-schnell', label: 'FLUX.1 Schnell — fast & best' },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', label: 'Stable Diffusion XL' },
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', label: 'SDXL Lightning — fast' },
  { id: '@cf/lykon/dreamshaper-8-lcm', label: 'DreamShaper 8' },
]

const genUrl = (prompt, model, seed) =>
  `/api/generate?prompt=${encodeURIComponent(prompt)}&model=${encodeURIComponent(model)}&seed=${seed}`

export default function Studio() {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState('logo')
  const [model, setModel] = useState(MODELS[0].id)
  const [results, setResults] = useState([])
  const [boards, setBoards] = useState([])
  const [arenas, setArenas] = useState([])
  const [boardId, setBoardId] = useState('')
  const [arenaId, setArenaId] = useState('')
  const [saved, setSaved] = useState({})
  const [usage, setUsage] = useState(null)

  const load = useCallback(async () => {
    const [b, a] = await Promise.all([
      supabase.from('boards').select('id,name').order('created_at'),
      supabase.from('arenas').select('id,title').order('created_at', { ascending: false }),
    ])
    setBoards(b.data || [])
    setArenas(a.data || [])
    if (a.data?.[0]) setArenaId(a.data[0].id)
    try { const r = await fetch('/api/usage'); if (r.ok) setUsage(await r.json()) } catch (e) {}
  }, [])
  useEffect(() => { load() }, [load])

  function generate(e) {
    e?.preventDefault()
    if (!prompt.trim()) return
    setSaved({})
    const wrapped = TYPES.find((t) => t.key === type).wrap(prompt.trim())
    setResults(Array.from({ length: 4 }, () => {
      const seed = Math.floor(Math.random() * 1e6)
      return { seed, url: genUrl(wrapped, model, seed), loaded: false, error: false }
    }))
    fetch('/api/usage').then((r) => r.ok && r.json().then(setUsage)).catch(() => {})
  }

  async function saveToMood(item) {
    setSaved((s) => ({ ...s, [item.seed]: 'saving' }))
    try {
      const { url } = await uploadFromUrl('brand', item.url, 'studio')
      const { data } = await supabase.from('moodboard_items').insert({
        type: 'image', url, board_id: boardId || null, caption: prompt.trim(), title: `AI: ${prompt.trim()}`, created_by: user.id,
      }).select().single()
      logActivity({ verb: 'added', entity_type: 'moodboard', entity_id: data?.id, summary: 'generated an image in the Studio', meta: { thumb_url: url } })
      setSaved((s) => ({ ...s, [item.seed]: 'mood' }))
    } catch (e) { setSaved((s) => ({ ...s, [item.seed]: false })); alert('Save failed: ' + e.message) }
  }

  async function sendToArena(item) {
    setSaved((s) => ({ ...s, [item.seed]: 'saving' }))
    try {
      let aId = arenaId
      if (!aId) {
        const { data } = await supabase.from('arenas').insert({ title: prompt.trim() || 'Logo options', created_by: user.id }).select().single()
        aId = data?.id; setArenas((cur) => [{ id: aId, title: prompt.trim() }, ...cur]); setArenaId(aId)
      }
      const { url } = await uploadFromUrl('brand', item.url, 'studio')
      await supabase.from('arena_candidates').insert({ arena_id: aId, label: 'AI concept', rationale: prompt.trim(), image_url: url, created_by: user.id })
      logActivity({ verb: 'added', entity_type: 'arena', entity_id: aId, summary: 'added an AI concept to an arena', meta: { thumb_url: url } })
      setSaved((s) => ({ ...s, [item.seed]: 'arena' }))
    } catch (e) { setSaved((s) => ({ ...s, [item.seed]: false })); alert('Save failed: ' + e.message) }
  }

  return (
    <div>
      <PageHeader title="Design Studio" subtitle="Describe it, generate it — logos, prints, patterns, mockups." />

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)}
              className={`chip h-8 px-3 border ${type === t.key ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}>{t.label}</button>
          ))}
        </div>
        <form onSubmit={generate} className="flex flex-col sm:flex-row gap-2">
          <input className="input flex-1 min-w-0" autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={type === 'logo' ? 'e.g. coastal streetwear wordmark, wave motif, sand tones' : 'describe what you want to see…'} />
          <button className="btn btn-primary shrink-0" disabled={!prompt.trim()}><Icon name="wand" size={16} /> Generate 4</button>
        </form>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs">
          <label className="flex items-center gap-1.5 text-muted">Model
            <select className="input h-8 w-auto text-xs" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <span className="text-faint">
            {!usage ? 'Checking quota…'
              : usage.configured === false ? '⚠ Cloudflare key not added yet'
              : usage.remaining != null ? `${usage.remaining.toLocaleString()} / ${usage.limit.toLocaleString()} neurons left today`
              : `Free tier: ${usage.limit.toLocaleString()} neurons/day`}
          </span>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 text-faint">
          <div className="h-14 w-14 rounded-2xl bg-accent-soft text-accent grid place-items-center mx-auto mb-4"><Icon name="wand" size={26} /></div>
          <p className="text-sm max-w-sm mx-auto">Pick a type, describe what you want, and generate four directions. Send the keepers to your Logo Arena or a mood board.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
            <span className="text-muted">Save to board:</span>
            <select className="input w-auto h-9" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
              <option value="">Mood (no board)</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="text-muted ml-2">Arena:</span>
            <select className="input w-auto h-9" value={arenaId} onChange={(e) => setArenaId(e.target.value)}>
              <option value="">+ New arena</option>
              {arenas.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {results.map((item) => (
              <div key={item.seed} className="card overflow-hidden">
                <div className="relative bg-canvas aspect-square grid place-items-center">
                  {!item.loaded && !item.error && <div className="absolute inset-0 grid place-items-center"><div className="h-6 w-6 rounded-full border-2 border-line-strong border-t-accent animate-spin" /></div>}
                  {item.error ? (
                    <div className="text-center p-3 text-xs text-faint"><Icon name="close" size={20} className="mx-auto mb-1 text-accent" /> Couldn't generate</div>
                  ) : (
                    <img src={item.url} alt="" className={`w-full h-full object-cover ${item.loaded ? '' : 'opacity-0'}`}
                      onLoad={() => setResults((r) => r.map((x) => x.seed === item.seed ? { ...x, loaded: true } : x))}
                      onError={() => setResults((r) => r.map((x) => x.seed === item.seed ? { ...x, error: true } : x))} />
                  )}
                </div>
                {!item.error && (
                  <div className="p-2 flex gap-1.5">
                    <button onClick={() => saveToMood(item)} disabled={saved[item.seed]} className="btn btn-soft h-8 flex-1 text-xs">{saved[item.seed] === 'mood' ? '✓ Saved' : saved[item.seed] === 'saving' ? '…' : <><Icon name="mood" size={13} /> Mood</>}</button>
                    <button onClick={() => sendToArena(item)} disabled={saved[item.seed]} className="btn btn-soft h-8 flex-1 text-xs text-accent">{saved[item.seed] === 'arena' ? '✓ Sent' : saved[item.seed] === 'saving' ? '…' : <><Icon name="trophy" size={13} /> Arena</>}</button>
                    <a href={item.url} target="_blank" rel="noreferrer" download className="btn btn-soft h-8 px-2 text-xs"><Icon name="download" size={13} /></a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
