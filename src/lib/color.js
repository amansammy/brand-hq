// Extract a small palette of dominant colors from an image URL (client-side, free).
// Works for same-origin / CORS-enabled images; rejects on tainted canvas.
export function extractPalette(url, count = 5) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = 64
        const h = Math.max(1, Math.round(w * (img.height / img.width)) || 64)
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        const buckets = {}
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue
          const r = data[i] & 0xF0, g = data[i + 1] & 0xF0, b = data[i + 2] & 0xF0
          const key = `${r},${g},${b}`
          buckets[key] = (buckets[key] || 0) + 1
        }
        const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, count)
          .map(([k]) => '#' + k.split(',').map((x) => Number(x).toString(16).padStart(2, '0')).join(''))
        resolve(top)
      } catch (e) { reject(e) }
    }
    img.onerror = reject
    img.src = url
  })
}
