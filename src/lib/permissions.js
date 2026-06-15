// ============================================================
// Permission model — granular, per-user, across every module.
//
// A user's access is stored on their profile row as:
//   role:        'owner' | 'full' | 'editor' | 'contributor' | 'viewer' | 'custom'
//   permissions: { [moduleKey]: string[] }   e.g. { files:['view','upload'] }
//
// 'owner' and 'full' bypass the map (can do everything). Every other role
// is just a convenient way to PREFILL the map — once you tick a box by hand
// the role becomes 'custom' but the map is what actually grants access.
//
// Enforced in two places that must stay in sync:
//   • the UI (hide/disable buttons)  — via can()
//   • the database (RLS policies)    — via supabase/v6-permissions.sql -> app_can()
// ============================================================

// Every module + the actions you can grant on it.
// action = [key, label].
export const MODULES = [
  { key: 'feed',  label: 'Feed',                icon: 'feed',   actions: [['post', 'Post updates'], ['moderate', 'Delete / clear feed']] },
  { key: 'tasks', label: 'Tasks & timeline',    icon: 'tasks',  actions: [['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['delete', 'Delete']] },
  { key: 'files', label: 'File vault',          icon: 'files',  actions: [['view', 'View'], ['upload', 'Upload'], ['edit', 'Edit'], ['delete', 'Delete']] },
  { key: 'notes', label: 'Notes',               icon: 'notes',  actions: [['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['delete', 'Delete']] },
  { key: 'mood',  label: 'Mood board',          icon: 'mood',   actions: [['view', 'View'], ['add', 'Add'], ['delete', 'Delete']] },
  { key: 'drops', label: 'Drops & collections', icon: 'drops',  actions: [['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['delete', 'Delete']] },
  { key: 'arena', label: 'Logo arena',          icon: 'trophy', actions: [['view', 'View'], ['create', 'Create'], ['vote', 'Vote'], ['delete', 'Delete']] },
  { key: 'brand', label: 'Brand bible',         icon: 'brand',  actions: [['view', 'View'], ['edit', 'Edit']] },
  { key: 'budget', label: 'Budget',             icon: 'wallet', actions: [['view', 'View'], ['edit', 'Edit']] },
  { key: 'suppliers', label: 'Suppliers & samples', icon: 'factory', actions: [['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['delete', 'Delete']] },
  { key: 'studio', label: 'Design studio',      icon: 'wand',   actions: [['view', 'View'], ['generate', 'Generate images']] },
]

export const ROLES = ['owner', 'full', 'editor', 'contributor', 'viewer', 'custom']

export const ROLE_PRESETS = {
  owner:       { label: 'Owner',        desc: 'Full control, including managing permissions. Locked.' },
  full:        { label: 'Full access',  desc: 'Can do everything except manage other users.' },
  editor:      { label: 'Editor',       desc: 'View, create and edit everywhere — but cannot delete.' },
  contributor: { label: 'Contributor',  desc: 'View everything, add tasks / notes / mood, vote, generate, comment.' },
  viewer:      { label: 'Viewer',       desc: 'Read-only. Can view and comment, nothing else.' },
  custom:      { label: 'Custom',       desc: 'Hand-picked permissions below.' },
}

const ALL_MAP = () => {
  const o = {}
  MODULES.forEach((m) => { o[m.key] = m.actions.map((a) => a[0]) })
  return o
}

const pick = (fn) => {
  const o = {}
  MODULES.forEach((m) => {
    const acts = m.actions.map((a) => a[0]).filter((a) => fn(m.key, a))
    if (acts.length) o[m.key] = acts
  })
  return o
}

// The permission map a preset prefills the matrix with.
export function presetPermissions(role) {
  switch (role) {
    case 'owner':
    case 'full':        return ALL_MAP()
    case 'editor':      return pick((m, a) => !['delete', 'moderate'].includes(a))
    case 'contributor': return pick((m, a) => ['view', 'create', 'add', 'post', 'vote', 'generate'].includes(a))
    case 'viewer':      return pick((m, a) => a === 'view')
    default:            return {}
  }
}

export function isOwnerRole(profile) {
  return profile?.role === 'owner'
}

// The one check the whole app uses.
export function can(profile, moduleKey, action) {
  if (!profile) return false
  if (profile.role === 'owner' || profile.role === 'full') return true
  const perms = profile.permissions || {}
  return Array.isArray(perms[moduleKey]) && perms[moduleKey].includes(action)
}

// Short human summary of a profile's access, for the admin list.
export function summarize(profile) {
  if (profile?.role === 'owner') return 'Owner · everything'
  if (profile?.role === 'full') return 'Full access'
  const perms = profile?.permissions || {}
  const granted = Object.values(perms).reduce((n, arr) => n + (arr?.length || 0), 0)
  if (granted === 0) return 'No access'
  const total = MODULES.reduce((n, m) => n + m.actions.length, 0)
  if (granted === total) return 'Full access'
  return `${granted} permission${granted === 1 ? '' : 's'}`
}
