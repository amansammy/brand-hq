import { supabase } from './supabase.js'

// Singleton id used to represent a link to the (single) Brand Bible.
export const BIBLE_ID = '00000000-0000-0000-0000-000000000001'

// Which entity types can be link targets, with display metadata.
export const LINK_TYPES = {
  collection: { label: 'Drop', icon: 'drops' },
  arena:      { label: 'Logo arena', icon: 'trophy' },
  file:       { label: 'File', icon: 'files' },
  note:       { label: 'Note', icon: 'notes' },
  brand_bible:{ label: 'Brand bible', icon: 'brand' },
}

export function linkRoute(type, id) {
  switch (type) {
    case 'collection': return `/drops?open=${id}`
    case 'arena':      return `/arena?open=${id}`
    case 'file':       return `/files?open=${id}`
    case 'note':       return `/notes?open=${id}`
    case 'brand_bible':return '/brand'
    case 'task':       return `/tasks?open=${id}`
    default:           return null
  }
}

// All link targets, flattened to { type, id, label, icon, thumb }.
export async function loadLinkCatalog() {
  const [c, a, f, n] = await Promise.all([
    supabase.from('collections').select('id,name,cover_url'),
    supabase.from('arenas').select('id,title'),
    supabase.from('files').select('id,name'),
    supabase.from('notes').select('id,title'),
  ])
  const out = []
  ;(c.data || []).forEach((x) => out.push({ type: 'collection', id: x.id, label: x.name, icon: 'drops', thumb: x.cover_url }))
  ;(a.data || []).forEach((x) => out.push({ type: 'arena', id: x.id, label: x.title, icon: 'trophy' }))
  ;(f.data || []).forEach((x) => out.push({ type: 'file', id: x.id, label: x.name, icon: 'files' }))
  ;(n.data || []).forEach((x) => out.push({ type: 'note', id: x.id, label: x.title || 'Untitled', icon: 'notes' }))
  out.push({ type: 'brand_bible', id: BIBLE_ID, label: 'Brand bible', icon: 'brand' })
  return out
}

export async function getLinksFrom(fromType, fromId) {
  const { data } = await supabase.from('links').select('*').eq('from_type', fromType).eq('from_id', fromId)
  return data || []
}

export async function getLinksTo(toType, toId) {
  const { data } = await supabase.from('links').select('*').eq('to_type', toType).eq('to_id', toId)
  return data || []
}

// Reconcile the links from an entity to match `desired` ([{to_type,to_id}]).
export async function syncLinks(fromType, fromId, desired, userId) {
  const existing = await getLinksFrom(fromType, fromId)
  const key = (t, i) => `${t}:${i}`
  const want = new Set(desired.map((d) => key(d.to_type, d.to_id)))
  const have = new Set(existing.map((e) => key(e.to_type, e.to_id)))

  const toAdd = desired.filter((d) => !have.has(key(d.to_type, d.to_id)))
  const toDel = existing.filter((e) => !want.has(key(e.to_type, e.to_id)))

  if (toAdd.length) {
    await supabase.from('links').insert(toAdd.map((d) => ({
      from_type: fromType, from_id: fromId, to_type: d.to_type, to_id: d.to_id, created_by: userId,
    })))
  }
  for (const e of toDel) await supabase.from('links').delete().eq('id', e.id)
}
