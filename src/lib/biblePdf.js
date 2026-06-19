// Load an image URL into a data URL so jsPDF can embed it. Returns null on failure.
function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight })
      } catch (e) { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Load an image and centre-crop it to a square JPEG data URL (for a tidy grid).
function loadSquare(url, size) {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = size; c.height = size
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, size, size)
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        const sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch (e) { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Build & download a formatted Brand Bible PDF.
// args: { bible, colors, manifestos, taglines, nameOf } where nameOf(userId) -> display name.
export async function exportBiblePdf({ bible = {}, colors = [], manifestos = [], taglines = [], referenceImages = [], logos = [], nameOf = () => '' }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 54
  const CW = PW - M * 2
  let y = M

  const INK = [28, 25, 23]
  const MUTED = [120, 113, 108]
  const ACCENT = [191, 91, 60]
  const LINE = [231, 226, 222]

  // ---- Embed the brand's chosen fonts (from the Typography section) ----
  const typo = parseTypo(bible.typography)
  const F = { H: null, B: null, BB: null, custom: false }
  if (typo.heading) F.H = await registerFont(doc, typo.heading, 700) || await registerFont(doc, typo.heading, 400)
  const bodyName = typo.body || typo.heading
  if (bodyName) {
    F.B = await registerFont(doc, bodyName, 400)
    F.BB = await registerFont(doc, bodyName, 700)
  }
  if (F.H || F.B) {
    F.custom = true
    F.H = F.H || F.B; F.B = F.B || F.H; F.BB = F.BB || F.B
  }
  // role ∈ 'heading' | 'body' | 'bold' | 'italic'
  function applyFont(role) {
    if (F.custom) {
      doc.setFont(role === 'heading' ? F.H : role === 'bold' ? F.BB : F.B, 'normal')
    } else {
      doc.setFont('helvetica', role === 'heading' || role === 'bold' ? 'bold' : role === 'italic' ? 'italic' : 'normal')
    }
  }

  function ensure(space) {
    if (y + space > PH - M) { doc.addPage(); y = M }
  }
  function heading(text) {
    ensure(40)
    y += 8
    applyFont('heading'); doc.setFontSize(13); doc.setTextColor(...ACCENT)
    doc.text(clean(text).toUpperCase(), M, y)
    y += 8
    doc.setDrawColor(...LINE); doc.setLineWidth(1)
    doc.line(M, y, M + CW, y)
    y += 16
  }
  function para(text, { size = 11, color = INK, gap = 6, font = 'normal' } = {}) {
    if (!text) return
    applyFont(font); doc.setFontSize(size); doc.setTextColor(...color)
    const lines = doc.splitTextToSize(clean(String(text)), CW)
    for (const ln of lines) {
      ensure(size + 4)
      doc.text(ln, M, y)
      y += size + 4
    }
    y += gap
  }

  // ---- Title ----
  applyFont('heading'); doc.setFontSize(32); doc.setTextColor(...INK)
  doc.text('Saint Monarch', M, y + 20); y += 36
  applyFont('body'); doc.setFontSize(10); doc.setTextColor(...MUTED)
  doc.text(clean(`Brand bible - exported ${new Date().toLocaleDateString()}`), M, y); y += 18

  // ---- Logos ----
  let logoList = logos.slice()
  if (!logoList.length && bible.logo_url) logoList = [{ label: 'Logo', url: bible.logo_url }]
  if (logoList.length) {
    const items = (await Promise.all(logoList.map(async (l) => ({ label: l.label, img: await loadImage(l.url) })))).filter((x) => x.img)
    if (items.length) {
      heading('Logos')
      para('Note: these logos are temporary placeholders and will be updated.', { size: 9, color: MUTED, font: 'italic', gap: 10 })
      const cols = items.length === 1 ? 1 : 2
      const gap = 14
      const cellW = (CW - gap * (cols - 1)) / cols
      const boxH = 120
      let i = 0
      while (i < items.length) {
        ensure(boxH + 26)
        const rowY = y
        for (let c = 0; c < cols && i < items.length; c++, i++) {
          const it = items[i]
          const x = M + c * (cellW + gap)
          doc.setDrawColor(...LINE); doc.setFillColor(250, 250, 250)
          doc.roundedRect(x, rowY, cellW, boxH, 6, 6, 'FD')
          const pad = 16, availW = cellW - pad * 2, availH = boxH - pad * 2
          let w = it.img.w, h = it.img.h
          const sc = Math.min(availW / w, availH / h, 1); w *= sc; h *= sc
          try { doc.addImage(it.img.data, 'PNG', x + (cellW - w) / 2, rowY + (boxH - h) / 2, w, h) } catch (e) {}
          applyFont('body'); doc.setFontSize(9); doc.setTextColor(...MUTED)
          doc.text(clean(it.label), x + 2, rowY + boxH + 13)
        }
        y = rowY + boxH + 26
      }
    }
  }

  const S = bible.sections || {}
  const sec = (k) => (S[k] || '').trim()

  if (sec('positioning')) { heading('Positioning'); para(sec('positioning'), { size: 13 }) }
  if (sec('audience')) { heading('Who it’s for'); para(sec('audience')) }

  // ---- Manifestos ----
  if (manifestos.length) {
    heading(manifestos.length > 1 ? 'Manifestos' : 'Manifesto')
    manifestos.forEach((m, i) => {
      para(m.content, { size: 12 })
      para(`— ${nameOf(m.created_by) || 'Unknown'}`, { size: 10, color: MUTED, font: 'italic', gap: i === manifestos.length - 1 ? 6 : 14 })
    })
  }

  const proseAfter = [
    ['aesthetic', 'Aesthetic & design direction'],
  ]
  proseAfter.forEach(([k, label]) => { if (sec(k)) { heading(label); para(sec(k)) } })

  // ---- Design principles ----
  const dos = bible.voice_do || [], donts = bible.voice_dont || []
  if (dos.length || donts.length) {
    heading('Design principles')
    if (dos.length) { para('We always', { size: 11, font: 'bold', gap: 2 }); dos.forEach((d) => para(`•  ${d}`, { gap: 1 })); y += 6 }
    if (donts.length) { para('We never', { size: 11, font: 'bold', gap: 2 }); donts.forEach((d) => para(`•  ${d}`, { gap: 1 })) }
  }

  // ---- Palette ----
  if (colors.length) {
    heading('Colour palette')
    const sw = 70, gap = 12, perRow = Math.floor((CW + gap) / (sw + gap))
    let i = 0
    while (i < colors.length) {
      ensure(sw + 34)
      const rowY = y
      for (let col = 0; col < perRow && i < colors.length; col++, i++) {
        const c = colors[i]
        const x = M + col * (sw + gap)
        const rgb = hexToRgb(c.hex)
        doc.setFillColor(...rgb); doc.setDrawColor(...LINE)
        doc.roundedRect(x, rowY, sw, sw, 6, 6, 'FD')
        applyFont('bold'); doc.setFontSize(8); doc.setTextColor(...INK)
        doc.text(doc.splitTextToSize(clean(c.name || c.hex), sw), x, rowY + sw + 12)
        applyFont('body'); doc.setTextColor(...MUTED)
        doc.text(clean(`${(c.hex || '').toUpperCase()}${c.code ? ' - ' + c.code : ''}`), x, rowY + sw + 22)
      }
      y = rowY + sw + 34
    }
  }

  // ---- Typography ----
  if (typo.heading || typo.body || typo.notes) {
    heading('Typography')
    if (typo.heading) para(`Heading:  ${typo.heading}`, { gap: 2 })
    if (typo.body) para(`Body:  ${typo.body}`, { gap: 2 })
    if (typo.notes) { y += 4; para(typo.notes, { color: MUTED }) }
  }

  // References + (optionally) the chosen mood board's images as an aligned grid.
  if (sec('references') || referenceImages.length) {
    heading('References & inspiration')
    if (sec('references')) para(sec('references'))
    if (referenceImages.length) {
      const squares = (await Promise.all(referenceImages.map((u) => loadSquare(u, 420)))).filter(Boolean)
      const cols = 3, gap = 10
      const cellW = (CW - gap * (cols - 1)) / cols
      const cellH = cellW
      let i = 0
      while (i < squares.length) {
        ensure(cellH + gap)
        const rowY = y
        for (let c = 0; c < cols && i < squares.length; c++, i++) {
          const x = M + c * (cellW + gap)
          try { doc.addImage(squares[i], 'JPEG', x, rowY, cellW, cellH) } catch (e) {}
        }
        y = rowY + cellH + gap
      }
      y += 4
    }
  }

  const proseEnd = [
    ['avoid', 'What we avoid'],
    ['sustainability', 'Sustainability & ethics'],
  ]
  proseEnd.forEach(([k, label]) => { if (sec(k)) { heading(label); para(sec(k)) } })

  // ---- Taglines ----
  if (taglines.length) {
    heading('Taglines')
    taglines.forEach((t) => {
      para(`“${t.content}”`, { size: 12, gap: 1 })
      para(`— ${nameOf(t.created_by) || 'Unknown'}`, { size: 9, color: MUTED, font: 'italic', gap: 10 })
    })
  }

  doc.save('brand-bible.pdf')
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return [200, 200, 200]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Fetch a TTF for a Google font (via Fontsource's CDN) and register it with jsPDF.
// Returns the internal font name, or null if unavailable.
const _fontCache = {}
async function registerFont(doc, family, weight) {
  if (!family) return null
  const slug = family.toLowerCase().trim().replace(/\s+/g, '-')
  const key = `${slug}-${weight}`
  try {
    if (_fontCache[key] === null) return null
    let b64 = _fontCache[key]
    if (!b64) {
      const url = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${weight}-normal.ttf`
      const res = await fetch(url)
      if (!res.ok) { _fontCache[key] = null; return null }
      b64 = arrayBufferToBase64(await res.arrayBuffer())
      _fontCache[key] = b64
    }
    const internal = `f_${slug}_${weight}`.replace(/[^a-z0-9_]/gi, '_')
    const fname = `${internal}.ttf`
    doc.addFileToVFS(fname, b64)
    doc.addFont(fname, internal, 'normal')
    return internal
  } catch (e) { _fontCache[key] = null; return null }
}

// Normalise smart punctuation & accents to plain glyphs the embedded fonts can render.
function clean(s) {
  return String(s)
    .replace(/[‘’‚′‵]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·●]/g, '-')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^\x20-\x7E\n]/g, '')                    // drop any other non-ASCII
}

function arrayBufferToBase64(buf) {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function parseTypo(raw) {
  try { const t = JSON.parse(raw || ''); if (t && typeof t === 'object') return { heading: t.heading || '', body: t.body || '', notes: t.notes || '' } } catch (e) {}
  return { heading: '', body: '', notes: raw || '' }
}
