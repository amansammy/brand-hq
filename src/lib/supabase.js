import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey && !url.includes('YOUR-PROJECT'))

// When not configured we still create a dummy client so imports don't crash;
// the app shows a setup screen instead of calling it.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
)

// --- Activity feed helper: log every meaningful action -------------
export async function logActivity({ verb, entity_type, entity_id, summary, body, meta }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('activity').insert({
    actor: user.id,
    verb,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    summary: summary ?? null,
    body: body ?? null,
    meta: meta ?? {},
  })
}

// Upload an image to a public bucket; returns { url, path }.
export async function uploadPublicImage(bucket, fileObj, prefix = '') {
  const safe = fileObj.name.replace(/[^\w.\-]+/g, '_')
  const path = `${prefix ? prefix + '/' : ''}${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(bucket).upload(path, fileObj)
  if (error) throw error
  const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  return { url, path }
}

// When an entity is deleted, remove its feed items, comments and reactions
// so the feed never references something that no longer exists.
export async function purgeEntity(entity_type, entity_id) {
  if (!entity_type || !entity_id) return
  await Promise.all([
    supabase.from('activity').delete().eq('entity_type', entity_type).eq('entity_id', entity_id),
    supabase.from('comments').delete().eq('entity_type', entity_type).eq('entity_id', entity_id),
    supabase.from('reactions').delete().eq('entity_type', entity_type).eq('entity_id', entity_id),
  ])
}
