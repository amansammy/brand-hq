// Emails with admin powers (clear feed, remove feed items, etc.)
export const ADMIN_EMAILS = ['amansammy98@gmail.com']

export function isAdmin(user) {
  if (!user?.email) return false
  return ADMIN_EMAILS.includes(user.email.toLowerCase())
}

// Map a feed activity (entity_type + id) to an in-app link.
// Uses the ?open= query param that each page reads to auto-open the item.
export function entityLink(entityType, entityId, meta = {}) {
  if (!entityId && entityType !== 'brand_bible' && entityType !== 'moodboard') return null
  switch (entityType) {
    case 'task':       return `/tasks?open=${entityId}`
    case 'file':       return `/files?open=${entityId}`
    case 'note':       return `/notes?open=${entityId}`
    case 'collection': return `/drops?open=${entityId}`
    case 'garment':    return meta.collection_id ? `/drops?open=${meta.collection_id}` : '/drops'
    case 'arena':      return `/arena?open=${entityId}`
    case 'candidate':  return meta.arena_id ? `/arena?open=${meta.arena_id}` : '/arena'
    case 'moodboard':  return '/mood'
    case 'brand_bible':return '/brand'
    default:           return null
  }
}
