import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, Spinner, PageHeader } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { FONTS, FONT_CATEGORIES, loadFont } from '../lib/fonts.js'
import { exportBiblePdf } from '../lib/biblePdf.js'
import { BIBLE_OPTIONS } from '../lib/bibleOptions.js'
import { timeAgo } from '../lib/util.js'

// Clothing-brand context fields, stored in brand_bible.sections (jsonb).
const PROSE = [
  { key: 'positioning', icon: 'flag', title: 'Positioning', hint: 'In one line — what is this brand? e.g. “Elevated basics for coastal mornings.”' },
  { key: 'audience', icon: 'user', title: 'Who it’s for', hint: 'The person you design for — their age, taste, lifestyle, and what they already wear.' },
  { key: 'aesthetic', icon: 'mood', title: 'Aesthetic & design direction', hint: 'The visual world — keywords, mood, era, textures, silhouettes.' },
  { key: 'references', icon: 'image', title: 'References & inspiration', hint: 'Brands, eras, people, places you look to.' },
  { key: 'avoid', icon: 'close', title: 'What we avoid', hint: 'Anti-references — trends, materials, or looks that aren’t us.' },
  { key: 'sustainability', icon: 'heart', title: 'Sustainability & ethics', hint: 'Materials, labour, packaging, end-of-life commitments.' },
]

export default function BrandBible() {
  const { user, profiles, can } = useAuth()
  const canEdit = can('brand', 'edit')
  const [bible, setBible] = useState(null)
  const [colors, setColors] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const nameOf = (id) => profiles.find((p) => p.id === id)?.display_name || 'Someone'

  // local editable copies
  const [sections, setSections] = useState({})
  const [heading, setHeading] = useState('')
  const [bodyFont, setBodyFont] = useState('')
  const [typoNotes, setTypoNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const typoEmpty = !heading && !bodyFont && !typoNotes
  const typography = typoEmpty ? '' : JSON.stringify({ heading, body: bodyFont, notes: typoNotes })

  // Mirror current editable values + the last-saved baseline, so a live reload
  // (e.g. someone adds a tagline) never wipes edits you haven't saved yet.
  const sectionsRef = useRef(sections); sectionsRef.current = sections
  const typoRef = useRef(typography); typoRef.current = typography
  const savedSectionsRef = useRef(null)
  const savedTypoRef = useRef(null)

  const load = useCallback(async () => {
    const [b, c, e] = await Promise.all([
      supabase.from('brand_bible').select('*').eq('id', 1).single(),
      supabase.from('palette_colors').select('*').order('position').order('created_at'),
      supabase.from('bible_entries').select('*').order('position').order('created_at'),
    ])
    if (b.data) {
      setBible(b.data)

      // Sections — only overwrite local state if it isn't holding unsaved edits.
      const newSections = b.data.sections || {}
      const sectionsClean = savedSectionsRef.current === null ||
        JSON.stringify(sectionsRef.current) === JSON.stringify(savedSectionsRef.current)
      if (sectionsClean) setSections(newSections)
      savedSectionsRef.current = newSections

      // Typography — same guard.
      const newTypo = b.data.typography || ''
      const typoClean = savedTypoRef.current === null || typoRef.current === savedTypoRef.current
      if (typoClean) {
        let h = '', bo = '', no = ''
        try { const t = JSON.parse(newTypo); if (t && typeof t === 'object') { h = t.heading || ''; bo = t.body || ''; no = t.notes || '' } else { no = newTypo } }
        catch { no = newTypo }
        setHeading(h); setBodyFont(bo); setTypoNotes(no)
        if (h) loadFont(h); if (bo) loadFont(bo)
      }
      savedTypoRef.current = newTypo
    }
    setColors(c.data || [])
    setEntries(e.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('bible')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_bible' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'palette_colors' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bible_entries' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function patch(fields, { log } = {}) {
    if (!canEdit) return
    await supabase.from('brand_bible').update({ ...fields, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', 1)
    if (log) logActivity({ verb: 'updated', entity_type: 'brand_bible', summary: `updated the brand bible — ${log}` })
    setBible((b) => ({ ...b, ...fields }))
  }

  async function saveText() {
    if (!canEdit) return
    setSaving(true)
    await patch({ sections, typography }, { log: 'context & type' })
    setSaving(false)
  }

  const manifestos = entries.filter((e) => e.kind === 'manifesto')
  const taglines = entries.filter((e) => e.kind === 'tagline')

  async function exportPdf() {
    setExporting(true)
    try {
      await exportBiblePdf({
        bible: { ...(bible || {}), sections, typography },
        colors, manifestos, taglines, nameOf,
      })
    } finally { setExporting(false) }
  }

  if (loading) return <Spinner />

  const sectionsDirty = JSON.stringify(sections) !== JSON.stringify(bible?.sections || {})
  const textDirty = sectionsDirty || typography !== (bible?.typography || '')
  const setSec = (k, v) => setSections((s) => ({ ...s, [k]: v }))

  return (
    <div>
      <PageHeader title="Brand bible" subtitle="The single source of truth for who the brand is."
        action={
          <div className="flex gap-2">
            {canEdit && textDirty && <button onClick={saveText} className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>}
            <button onClick={exportPdf} className="btn btn-soft" disabled={exporting}>
              <Icon name="download" size={16} /> {exporting ? 'Building…' : 'Export PDF'}
            </button>
          </div>
        } />

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

        {/* Positioning + audience */}
        {['positioning', 'audience'].map((k) => {
          const cfg = PROSE.find((p) => p.key === k)
          return <ProseSection key={k} cfg={cfg} value={sections[k] || ''} onChange={(v) => setSec(k, v)} canEdit={canEdit} />
        })}

        {/* Manifestos — multiple, attributed */}
        <Section icon="notes" title={manifestos.length > 1 ? 'Manifestos' : 'Manifesto'}>
          <EntryList kind="manifesto" entries={manifestos} user={user} canEdit={canEdit} nameOf={nameOf}
            placeholder="What does this brand stand for? Write your take on the manifesto…"
            big addLabel="Add a manifesto" />
        </Section>

        {/* Aesthetic */}
        {['aesthetic'].map((k) => {
          const cfg = PROSE.find((p) => p.key === k)
          return <ProseSection key={k} cfg={cfg} value={sections[k] || ''} onChange={(v) => setSec(k, v)} canEdit={canEdit} />
        })}

        {/* Design principles (repurposed voice do/don't) */}
        <Section icon="flag" title="Design principles">
          <p className="text-sm text-muted -mt-1 mb-3">The rules you hold yourself to — handy for briefing a manufacturer or a freelance designer.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ListEditor label="We always" accent="ok" items={bible.voice_do || []} readOnly={!canEdit}
              onChange={(v) => patch({ voice_do: v })} placeholder="e.g. Pre-wash every fabric" />
            <ListEditor label="We never" accent="no" items={bible.voice_dont || []} readOnly={!canEdit}
              onChange={(v) => patch({ voice_dont: v })} placeholder="e.g. Use plastic trims" />
          </div>
        </Section>

        {/* Palette */}
        <Section icon="mood" title="Colour palette">
          <Palette colors={colors} user={user} canEdit={canEdit} />
        </Section>

        {/* Typography */}
        <Section icon="type" title="Typography">
          <FontPicker heading={heading} body={bodyFont} onHeading={canEdit ? setHeading : undefined} onBody={canEdit ? setBodyFont : undefined} canEdit={canEdit} />
          <textarea className="input min-h-[70px] mt-3" readOnly={!canEdit}
            placeholder="Usage notes — e.g. Headlines in caps, body at 16px…"
            value={typoNotes} onChange={(e) => setTypoNotes(e.target.value)} />
        </Section>

        {/* References / avoid / sustainability */}
        {['references', 'avoid', 'sustainability'].map((k) => {
          const cfg = PROSE.find((p) => p.key === k)
          return <ProseSection key={k} cfg={cfg} value={sections[k] || ''} onChange={(v) => setSec(k, v)} canEdit={canEdit} />
        })}

        {/* Taglines — multiple, attributed */}
        <Section icon="trophy" title="Tagline bank">
          <EntryList kind="tagline" entries={taglines} user={user} canEdit={canEdit} nameOf={nameOf}
            placeholder="Add a tagline idea" addLabel="Add tagline" />
        </Section>
      </div>
    </div>
  )
}

// A single free-text context section saved into brand_bible.sections.
// Offers curated, clickable streetwear suggestions that append into the field.
function ProseSection({ cfg, value, onChange, canEdit }) {
  const options = BIBLE_OPTIONS[cfg.key] || []
  // crude "already added" check so picked chips drop out of the list
  const has = (opt) => value.toLowerCase().includes(opt.toLowerCase())

  function append(opt) {
    const cur = value.trim()
    if (!cur) return onChange(opt)
    if (has(opt)) return
    const sep = /[,\n]\s*$/.test(value) ? ' ' : ', '
    onChange(value + sep + opt)
  }

  return (
    <Section icon={cfg.icon} title={cfg.title}>
      {canEdit ? (
        <>
          <textarea className="input min-h-[80px] leading-relaxed" placeholder={cfg.hint}
            value={value} onChange={(e) => onChange(e.target.value)} />
          {options.length > 0 && (
            <div className="mt-2.5">
              <p className="text-xs text-faint mb-1.5">Tap to add — streetwear suggestions:</p>
              <div className="flex flex-wrap gap-1.5">
                {options.filter((o) => !has(o)).map((o) => (
                  <button key={o} type="button" onClick={() => append(o)}
                    className="chip h-7 px-2.5 border border-line text-muted hover:border-accent hover:text-accent transition-colors">
                    <Icon name="plus" size={11} /> {o}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : value ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-faint italic">Nothing added yet.</p>
      )}
    </Section>
  )
}

// Attributed list of bible_entries (manifestos or taglines).
function EntryList({ kind, entries, user, canEdit, nameOf, placeholder, addLabel, big }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    if (!val.trim() || busy) return
    setBusy(true)
    const pos = (entries[entries.length - 1]?.position || 0) + 1
    await supabase.from('bible_entries').insert({ kind, content: val.trim(), position: pos, created_by: user.id })
    logActivity({ verb: 'added', entity_type: 'brand_bible', summary: `added a ${kind} to the brand bible` })
    setVal(''); setBusy(false)
  }
  async function remove(id) { await supabase.from('bible_entries').delete().eq('id', id) }

  return (
    <div>
      <div className={`space-y-3 ${entries.length ? 'mb-4' : ''}`}>
        {entries.map((e) => (
          <div key={e.id} className="group rounded-xl border border-line p-3">
            <p className={`whitespace-pre-wrap break-words ${big ? 'text-[15px] leading-relaxed font-display' : 'text-sm'}`}>{e.content}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-faint">
              <Avatar profile={{ id: e.created_by, display_name: nameOf(e.created_by) }} size={18} />
              <span>{nameOf(e.created_by)}</span>
              <span>· {timeAgo(e.created_at)}</span>
              {canEdit && (
                <button onClick={() => remove(e.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-faint hover:text-accent transition-opacity">
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-faint italic">Nothing added yet.</p>}
      </div>
      {canEdit && (
        <form onSubmit={add} className="flex gap-2 items-start">
          {big
            ? <textarea className="input min-h-[60px] text-sm" placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} />
            : <input className="input h-9 text-sm" placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} />}
          <button className="btn btn-soft shrink-0 h-9 px-3" disabled={!val.trim() || busy}><Icon name="plus" size={15} /> {addLabel}</button>
        </form>
      )}
    </div>
  )
}

function FontPicker({ heading, body, onHeading, onBody, canEdit = true }) {
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

      {!canEdit ? null : (<>
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
              onHeading={() => onHeading?.(f.name)} onBody={() => onBody?.(f.name)} />
          ))}
        </div>
      </>)}
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
        <button onClick={onHeading} className={`h-7 px-2 rounded-lg text-xs font-medium border ${isHeading ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-line-strong'}`}>Heading</button>
        <button onClick={onBody} className={`h-7 px-2 rounded-lg text-xs font-medium border ${isBody ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-line-strong'}`}>Body</button>
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

function ListEditor({ label, items, onChange, placeholder, accent, big, readOnly }) {
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
            {!readOnly && <button onClick={() => remove(i)} className="text-faint hover:text-accent ml-0.5"><Icon name="close" size={12} /></button>}
          </span>
        ))}
      </div>
      {!readOnly && (
      <form onSubmit={add} className="flex gap-2">
        <input className="input h-9 text-sm" placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} />
        <button className="btn btn-soft h-9 px-3 shrink-0" disabled={!val.trim()}><Icon name="plus" size={15} /></button>
      </form>
      )}
    </div>
  )
}

function Palette({ colors, user, canEdit = true }) {
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
              {canEdit && <button onClick={() => remove(c)} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/40 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="close" size={13} />
              </button>}
            </div>
            <p className="text-sm font-medium mt-1.5 truncate">{c.name || c.hex}</p>
            <p className="text-xs text-faint uppercase">{c.hex}{c.code ? ` · ${c.code}` : ''}</p>
          </div>
        ))}

        {!canEdit ? null : adding ? (
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
