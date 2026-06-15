// Vercel serverless function: proxies image generation to Cloudflare Workers AI.
// Keeps CF_ACCOUNT_ID + CF_API_TOKEN server-side (never exposed to the browser).
// Returns the generated image bytes so it can be used directly as an <img src>.

const MODELS = new Set([
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
])

export default async function handler(req, res) {
  const ACCOUNT = process.env.CF_ACCOUNT_ID
  const TOKEN = process.env.CF_API_TOKEN
  if (!ACCOUNT || !TOKEN) {
    res.status(503).json({ error: 'not_configured', message: 'Cloudflare keys not set yet (CF_ACCOUNT_ID, CF_API_TOKEN).' })
    return
  }
  const prompt = (req.query.prompt || '').toString().slice(0, 1500)
  const model = MODELS.has(req.query.model) ? req.query.model : '@cf/black-forest-labs/flux-1-schnell'
  const seed = req.query.seed ? Number(req.query.seed) : undefined
  if (!prompt) { res.status(400).json({ error: 'missing_prompt' }); return }

  const body = { prompt }
  if (seed != null && !Number.isNaN(seed)) body.seed = seed
  if (model.includes('flux')) body.steps = 6

  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const j = await r.json()
      if (!j.success) { res.status(502).json({ error: 'cf_error', message: j.errors?.[0]?.message || 'generation failed' }); return }
      const b64 = j.result?.image
      if (!b64) { res.status(502).json({ error: 'no_image' }); return }
      const buf = Buffer.from(b64, 'base64')
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.status(200).send(buf)
      return
    }
    const ab = await r.arrayBuffer()
    if (!r.ok) { res.status(502).json({ error: 'cf_error' }); return }
    res.setHeader('Content-Type', ct || 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.status(200).send(Buffer.from(ab))
  } catch (e) {
    res.status(500).json({ error: 'proxy_error', message: String(e?.message || e) })
  }
}
