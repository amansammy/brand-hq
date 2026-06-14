import { supabase } from './supabase.js'

// Create notifications for recipients (excluding the actor).
export async function notify({ userIds, actor, type, body, link, entity_type, entity_id }) {
  const recipients = [...new Set((userIds || []).filter((id) => id && id !== actor))]
  if (!recipients.length) return
  await supabase.from('notifications').insert(recipients.map((uid) => ({
    user_id: uid, actor, type, body: body ?? null, link: link ?? null,
    entity_type: entity_type ?? null, entity_id: entity_id ?? null,
  })))
}

// Find which profiles are @mentioned in a piece of text (matches display names).
export function parseMentions(text, profiles) {
  if (!text) return []
  const ids = new Set()
  const sorted = [...profiles].sort((a, b) => (b.display_name || '').length - (a.display_name || '').length)
  for (const p of sorted) {
    const name = p.display_name
    if (!name) continue
    const re = new RegExp('@' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
    if (re.test(text)) ids.add(p.id)
  }
  return [...ids]
}
