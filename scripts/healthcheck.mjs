import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// crude .env parser
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
console.log('URL:', url)
const sb = createClient(url, key)

const tables = ['profiles','tasks','milestones','files','file_versions','notes','moodboard_items','comments','reactions','activity']
let ok = 0, bad = 0
for (const t of tables) {
  const { error } = await sb.from(t).select('*', { head: true, count: 'exact' })
  if (error) { console.log('  ✗', t, '-', error.message); bad++ }
  else { console.log('  ✓', t); ok++ }
}

// storage buckets
const { data: buckets, error: be } = await sb.storage.listBuckets()
if (be) console.log('  ✗ buckets -', be.message)
else console.log('  buckets:', buckets.map((b) => `${b.name}${b.public ? ' (public)' : ''}`).join(', ') || '(none visible to anon)')

console.log(`\nTables: ${ok} ok, ${bad} failed`)
process.exit(bad ? 1 : 0)
