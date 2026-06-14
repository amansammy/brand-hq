import { formatDistanceToNow, format, isToday } from 'date-fns'

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

const AVATAR_COLORS = ['#bf5b3c', '#3c6ebf', '#3c8f6e', '#8f6e3c', '#6e3c8f', '#b03c6e']
export function colorFromId(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function timeAgo(date) {
  if (!date) return ''
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) } catch { return '' }
}

export function prettyDate(date) {
  if (!date) return ''
  const d = new Date(date)
  try {
    if (isToday(d)) return 'Today'
    return format(d, 'MMM d, yyyy')
  } catch { return '' }
}

// Local "today" as yyyy-mm-dd (for date input min=, avoids predating)
export function todayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, n = bytes
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}
