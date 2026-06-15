// Image-generation model catalog across free providers.
// provider: 'cf' (Cloudflare Workers AI, live) | 'hf' (Hugging Face, needs a free token)
// distilled models (flux schnell, turbo, lcm, lightning) ignore guidance/negative prompt.
export const MODELS = [
  // ---- Cloudflare Workers AI (live, free 10k neurons/day) ----
  { id: 'cf:flux-schnell', provider: 'cf', model: '@cf/black-forest-labs/flux-1-schnell', label: 'FLUX.1 Schnell', desc: 'Crisp & modern — great for logos & wordmarks. Fast.', group: 'Cloudflare · live', maxSteps: 8, distilled: true, sizeLocked: true },
  { id: 'cf:sdxl', provider: 'cf', model: '@cf/stabilityai/stable-diffusion-xl-base-1.0', label: 'Stable Diffusion XL', desc: 'Photoreal & detailed — mood images & mockups.', group: 'Cloudflare · live', maxSteps: 20 },
  { id: 'cf:sdxl-lightning', provider: 'cf', model: '@cf/bytedance/stable-diffusion-xl-lightning', label: 'SDXL Lightning', desc: 'Very fast SDXL drafts.', group: 'Cloudflare · live', maxSteps: 8, distilled: true },
  { id: 'cf:dreamshaper', provider: 'cf', model: '@cf/lykon/dreamshaper-8-lcm', label: 'DreamShaper 8 LCM', desc: 'Stylised & artistic, fast.', group: 'Cloudflare · live', maxSteps: 8, distilled: true },

  // ---- Hugging Face (free tier now only serves FLUX.1-schnell) ----
  { id: 'hf:flux-schnell', provider: 'hf', model: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell', desc: 'Fast, sharp, modern — HF\'s free model.', group: 'Hugging Face · free', maxSteps: 8, distilled: true },
]

export const SIZES = [
  { id: '1024x1024', label: 'Square' },
  { id: '768x768', label: 'Square (small)' },
  { id: '832x1216', label: 'Portrait' },
  { id: '1216x832', label: 'Landscape' },
]

export function modelById(id) { return MODELS.find((m) => m.id === id) || MODELS[0] }
export const MODEL_GROUPS = [...new Set(MODELS.map((m) => m.group))]
