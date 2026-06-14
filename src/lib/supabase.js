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
