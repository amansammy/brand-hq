import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Spinner, PageHeader } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { FONTS, FONT_CATEGORIES, loadFont } from '../lib/fonts.js'

export default function BrandBible() {
  const { user } = useAuth()
  const [bible, setBible] = useState(null)
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)

  // local editable copies for free-text sections
  const [manifesto, setManifesto] = useState('')
  const [heading, setHeading] = useState('')
  const [bodyFont, setBodyFont] = useState('')
  const [typoNotes, setTypoNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const typoEmpty = !heading && !bodyFont && !typoNotes
  const typography = typoEmpty ? '' : JSON.stringify({ heading, body: bodyFont, notes: typoNotes })

  const load = useCallback(async () => {
    const [b, c] = await Promise.all([
      supabase.from('brand_bible').select('*').eq('id', 1).single(),
      supabase.from('palette_colors').select('*').order('position').order('created_at'),
    ])
    if (b.data) {
      setBible(b.data); setManifesto(b.data.manifesto || '')
      let h = '', bo = '', no = ''
      try { const t = JSON.parse(b.data.typography || ''); if (t && typeof t === 'object') { h = t.heading || ''; bo = t.body || ''; no = t.notes || '' } else { no = b.data.typography || '' } }
      catch { no = b.data.typography || '' }
      setHeading(h); setBodyFont(bo); setTypoNotes(no)
      if (h) loadFont(h); if (bo) loadFont(bo)
    }
    setColors(c.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('bible')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_bible' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'palette_colors' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function patch(fields, { log } = {}) {
    await supabase.from('brand_bible').update({ ...fields, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', 1)
    if (log) logActivity({ verb: 'updated', entity_type: 'brand_bible', summary: `updated the brand bible — ${log}` })
    setBible((b) => ({ ...b, ...fields }))
  }

  async function saveText() {
    setSaving(true)
    await patch({ manifesto, typography }, { log: 'manifesto & type' })
    setSaving(false)
  }

  if (loading) return <Spinner />
  const textDirty = manifesto !== (bible?.manifesto || '') || typography !== (bible?.typography || '')

  return (
    <div>
      <PageHeader title="Brand bible" subtitle="The single source of truth for who the brand is."
        action={textDirty && <button onClick={saveText} className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>} />

      <div className="space-y-5">
        {/* Logo (auto-set from the Logo Arena winner) */}
        {bible.logo_url && (
          <Section icon="trophy" title="Logo">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-xl border border-line bg-canvas grid place-items-center overflow-hidden shrink-0">
                <img src={bible.logo_url} alt="Brand logo" className="max-h-24 max-w-full object-contain" />
              </div>
              <p className="text-sm text-muted">Chosen in the Logo Arena. Pick a different winner there and it updates here automatically.</p>
            </div>
          </Section>
        )}

        {/* Manifesto */}
        <Section icon="notes" title="Manifesto">
          <textarea className="input min-h-[160px] leading-relaxed font-display text-[15px]"
            placeholder="What does this brand stand for? Write the manifesto here…"
            value={manifesto} onChange={(e) => setManifesto(e.target.value)} />
        </Section>

        {/* Voice */}
        <Section icon="feed" title="Voice & tone">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ListEditor label="We sound like" accent="ok" items={bible.voice_do || []}
              onChange={(v) => patch({ voice_do: v })} placeholder="e.g. Confident, warm" />
            <ListEditor label="We never sound like" accent="no" items={bible.voice_dont || []}
              onChange={(v) => patch({ voice_dont: v })} placeholder="e.g. Salesy, loud" />
          </div>
        </Section>

        {/* Palette */}
        <Section icon="mood" title="Color palette">
          <Palette colors={colors} user={user} />
        </Section>

        {/* Typography */}
        <Section icon="type" title="Typography">
          <FontPicker heading={heading} body={bodyFont} onHeading={setHeading} onBody={setBodyFont} />
          <textarea className="input min-h-[70px] mt-3"
            placeholder="Usage notes — e.g. Headlines in caps, body at 16px…"
            value={typoNotes} onChange={(e) => setTypoNotes(e.target.value)} />
        </Section>

        {/* Taglines */}
        <Section icon="trophy" title="Tagline bank">
          <ListEditor label="Candidate taglines" items={bible.taglines || []}
            onChange={(v) => patch({ taglines: v })} placeholder="Add a tagline idea" big />
        </Section>
      </div>
    </div>
  )
}

function FontPicker({ heading, body, onHeading, onBody }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [sample, setSample] = useState('Your brand name')

  useEffect(() => { if (heading) loadFont(heading); if (body) loadFont(body) }, [heading, body])

  const list = FONTS.filter((f) =>
    (cat === 'all' || f.cat === cat) && (!q || f.name.toLowerCase().includes(q.toLowerCase())))

  return (
    <div>
      {/* Selected preview */}
      <div className="rounded-xl border border-line bg-canvas p-4 mb-3">
        <p className="text-3xl leading-tight break-words" style={{ fontFamily: heading ? `'${heading}'` : 'inherit' }}>{sample || 'Your brand name'}</p>
        <p className="text-sm mt-2 text-muted" style={{ fontFamily: body ? `'${body}'` : 'inherit' }}>
          The quick brown fox jumps over the lazy dog — 0123456789
        </p>
        <p className="text-xs text-faint mt-2">
          Heading: <span className="font-medium text-muted">{heading || '—'}</span> · Body: <span className="font-medium text-muted">{body || '—'}</span>
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input className="input h-9 text-sm flex-1 min-w-0" placeholder="Search fonts…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input h-9 text-sm flex-1 min-w-0" placeholder="Preview text" value={sample} onChange={(e) => setSample(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {FONT_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`chip h-7 px-2.5 border ${cat === c.key ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}>{c.label}</button>
        ))}
      </div>

      {/* Gallery */}
      <div className="border border-line rounded-xl divide-y divide-line max-h-80 overflow-y-auto">
        {list.length === 0 && <p className="text-sm text-faint text-center py-8">No fonts match.</p>}
        {list.map((f) => (
          <FontRow key={f.name} font={f} sample={sample}
            isHeading={heading === f.name} isBody={body === f.name}
            onHeading={() => onHeading(f.name)} onBody={() => onBody(f.name)} />
        ))}
      </div>
    </div>
  )
}

function FontRow({ font, sample, isHeading, isBody, onHeading, onBody }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { loadFont(font.name); setVisible(true); ob.disconnect() }
    }, { rootMargin: '120px' })
    ob.observe(el)
    return () => ob.disconnect()
  }, [font.name])

  return (
    <div ref={ref} className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xl leading-tight truncate" style={{ fontFamily: visible ? `'${font.name}'` : 'inherit' }}>
          {sample || font.name}
        </p>
        <p className="text-[11px] text-faint">{font.name}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onHeading} className={`h-7 px-2 rounded-lg text-xs font-medium border ${isHeading ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:border-line-strong'}`}>Heading</button>
        <button onClick={onBody} className={`h-7 px-2 rounded-lg text-xs font-medium border ${isBody ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:border-line-strong'}`}>Body</button>
      </div>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={17} className="text-accent" />
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ListEditor({ label, items, onChange, placeholder, accent, big }) {
  const [val, setVal] = useState('')
  function add(e) {
    e.preventDefault()
    if (!val.trim()) return
    onChange([...(items || []), val.trim()]); setVal('')
  }
  function remove(i) { onChange(items.filter((_, idx) => idx !== i)) }
  const dot = accent === 'ok' ? 'text-green-600' : accent === 'no' ? 'text-accent' : 'text-faint'

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className={`flex flex-wrap gap-2 ${items?.length ? 'mb-2' : ''}`}>
        {(items || []).map((it, i) => (
          <span key={i} className={`group chip ${big ? 'h-8 px-3' : 'h-7 px-2.5'} bg-canvas border border-line`}>
            {accent && <span className={dot}>{accent === 'ok' ? '✓' : '✕'}</span>}
            {it}
            <button onClick={() => remove(i)} className="text-faint hover:text-accent ml-0.5"><Icon name="close" size={12} /></button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input className="input h-9 text-sm" placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} />
        <button className="btn btn-soft h-9 px-3 shrink-0" disabled={!val.trim()}><Icon name="plus" size={15} /></button>
      </form>
    </div>
  )
}

function Palette({ colors, user }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [hex, setHex] = useState('#bf5b3c')
  const [code, setCode] = useState('')

  async function add() {
    await supabase.from('palette_colors').insert({ name: name.trim() || null, hex, code: code.trim() || null, created_by: user.id })
    setName(''); setCode(''); setHex('#bf5b3c'); setAdding(false)
  }
  async function remove(c) { await supabase.from('palette_colors').delete().eq('id', c.id) }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {colors.map((c) => (
          <div key={c.id} className="group w-28">
            <div className="h-20 rounded-xl border border-line relative" style={{ background: c.hex }}>
              <button onClick={() => remove(c)} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/40 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="close" size={13} />
              </button>
            </div>
            <p className="text-sm font-medium mt-1.5 truncate">{c.name || c.hex}</p>
            <p className="text-xs text-faint uppercase">{c.hex}{c.code ? ` · ${c.code}` : ''}</p>
          </div>
        ))}

        {adding ? (
          <div className="w-44 card p-3 animate-in">
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-full h-12 rounded-lg cursor-pointer mb-2 border border-line" />
            <input className="input h-8 text-sm mb-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input h-8 text-sm mb-2" placeholder="Fabric / Pantone code" value={code} onChange={(e) => setCode(e.target.value)} />
            <div className="flex gap-1.5">
              <button onClick={() => setAdding(false)} className="btn btn-soft h-8 flex-1 text-xs">Cancel</button>
              <button onClick={add} className="btn btn-primary h-8 flex-1 text-xs">Add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-28 h-20 rounded-xl border border-dashed border-line-strong grid place-items-center text-faint hover:border-accent hover:text-accent transition-colors">
            <Icon name="plus" size={22} />
          </button>
        )}
      </div>
    </div>
  )
}
