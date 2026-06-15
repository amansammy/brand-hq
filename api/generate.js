// Vercel serverless function: image generation across providers.
// Cloudflare Workers AI (CF_*) and Hugging Face Inference (HF_TOKEN).
// Keys stay server-side. Returns image bytes for use as an <img src>.

const CF_MODELS = new Set([
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
])

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : undefined }

export default async function handler(req, res) {
  const provider = (req.query.provider || 'cf').toString()
  const prompt = (req.query.prompt || '').toString().slice(0, 2000)
  const model = (req.query.model || '').toString()
  const negative = (req.query.negative || '').toString().slice(0, 1000)
  const steps = num(req.query.steps)
  const guidance = num(req.query.guidance)
  const width = num(req.query.width)
  const height = num(req.query.height)
  const seed = num(req.query.seed)
  if (!prompt) { res.status(400).json({ error: 'missing_prompt' }); return }

  try {
    if (provider === 'hf') return await generateHF({ res, model, prompt, negative, steps, guidance, width, height, seed })
    return await generateCF({ res, model, prompt, negative, steps, guidance, width, height, seed })
  } catch (e) {
    res.status(500).json({ error: 'proxy_error', message: String(e?.message || e) })
  }
}

async function generateCF({ res, model, prompt, negative, steps, guidance, width, height, seed }) {
  const ACCOUNT = process.env.CF_ACCOUNT_ID
  const TOKEN = process.env.CF_API_TOKEN
  if (!ACCOUNT || !TOKEN) { res.status(503).json({ error: 'not_configured', message: 'Cloudflare keys not set.' }); return }
  const m = CF_MODELS.has(model) ? model : '@cf/black-forest-labs/flux-1-schnell'
  const isFlux = m.includes('flux')
  const body = { prompt }
  if (seed != null) body.seed = seed
  if (isFlux) {
    body.steps = Math.min(8, steps || 6)
  } else {
    if (negative) body.negative_prompt = negative
    if (steps) body.num_steps = Math.min(20, steps)
    if (guidance != null) body.guidance = guidance
    if (width) body.width = width
    if (height) body.height = height
  }
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${m}`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const j = await r.json()
    if (!j.success) { res.status(502).json({ error: 'cf_error', message: j.errors?.[0]?.message || 'failed' }); return }
    const b64 = j.result?.image
    if (!b64) { res.status(502).json({ error: 'no_image' }); return }
    sendImage(res, Buffer.from(b64, 'base64'), 'image/jpeg'); return
  }
  const ab = await r.arrayBuffer()
  if (!r.ok) { res.status(502).json({ error: 'cf_error' }); return }
  sendImage(res, Buffer.from(ab), ct || 'image/png')
}

async function generateHF({ res, model, prompt, negative, steps, guidance, width, height, seed }) {
  const HF = process.env.HF_TOKEN
  if (!HF) { res.status(503).json({ error: 'not_configured', message: 'Hugging Face token not set.' }); return }
  const parameters = {}
  if (negative) parameters.negative_prompt = negative
  if (steps) parameters.num_inference_steps = steps
  if (guidance != null) parameters.guidance_scale = guidance
  if (width) parameters.width = width
  if (height) parameters.height = height
  if (seed != null) parameters.seed = seed
  const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HF}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify({ inputs: prompt, parameters, options: { wait_for_model: true } }),
  })
  const ct = r.headers.get('content-type') || ''
  if (!r.ok || ct.includes('application/json')) {
    let msg = 'Hugging Face error'
    try { const j = await r.json(); msg = j.error || msg } catch (e) {}
    res.status(502).json({ error: 'hf_error', message: msg }); return
  }
  const ab = await r.arrayBuffer()
  sendImage(res, Buffer.from(ab), ct || 'image/png')
}

function sendImage(res, buf, type) {
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.status(200).send(buf)
}
