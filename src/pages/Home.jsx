import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, Spinner } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { prettyDate, timeAgo } from '../lib/util.js'
import { differenceInCalendarDays, isPast, isToday, parseISO } from 'date-fns'

export default function Home() {
  const { user, profiles } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const me = profiles.find((p) => p.id === user?.id)
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: 'Someone' }

  const load = useCallback(async () => {
    const [collections, tasks, arenas, candidates, palette, bible, activity] = await Promise.all([
      supabase.from('collections').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('arenas').select('*'),
      supabase.from('arena_candidates').select('arena_id,is_winner'),
      supabase.from('palette_colors').select('id'),
      supabase.from('brand_bible').select('*').eq('id', 1).single(),
      supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(6),
    ])
    setData({
      collections: collections.data || [], tasks: tasks.data || [], arenas: arenas.data || [],
      candidates: candidates.data || [], palette: palette.data || [], bible: bible.data || {}, activity: activity.data || [],
    })
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  if (!data) return <Spinner />

  // Nearest upcoming drop
  const upcoming = data.collections
    .filter((c) => c.launch_date && c.status !== 'launched')
    .sort((a, b) => new Date(a.launch_date) - new Date(b.launch_date))[0]
  const upcomingDays = upcoming ? differenceInCalendarDays(new Date(upcoming.launch_date), new Date()) : null

  // Needs you
  const myTasks = data.tasks.filter((t) => t.assignee === user?.id && t.status !== 'done')
  const overdue = myTasks.filter((t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)))
  const dueToday = myTasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)))

  // Open decisions (arenas with no winner)
  const winnersByArena = new Set(data.candidates.filter((c) => c.is_winner).map((c) => c.arena_id))
  const openArenas = data.arenas.filter((a) => !winnersByArena.has(a.id))

  // Bible completeness
  const checks = [
    { ok: !!data.bible.manifesto?.trim(), label: 'Manifesto', to: '/brand' },
    { ok: (data.bible.voice_do?.length || 0) > 0, label: 'Voice', to: '/brand' },
    { ok: data.palette.length > 0, label: 'Palette', to: '/brand' },
    { ok: !!data.bible.logo_url, label: 'Logo', to: '/arena' },
    { ok: (data.bible.taglines?.length || 0) > 0, label: 'Tagline', to: '/brand' },
  ]
  const biblePct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">{greeting}{me ? `, ${me.display_name}` : ''}</h1>
        <p className="text-sm text-muted mt-1">Here's where the brand stands today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nearest drop */}
        <Card title="Next drop" icon="drops" onAll={() => navigate('/drops')}>
          {upcoming ? (
            <button onClick={() => navigate(`/drops?open=${upcoming.id}`)} className="text-left w-full">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl">{upcomingDays <= 0 ? 'Today' : upcomingDays}</span>
                {upcomingDays > 0 && <span className="text-sm text-muted">days to launch</span>}
              </div>
              <p className="text-sm font-medium mt-1 truncate">{upcoming.name}</p>
              <p className="text-xs text-faint">{prettyDate(upcoming.launch_date)}</p>
            </button>
          ) : <Empty text="No upcoming drop with a launch date." />}
        </Card>

        {/* Needs you */}
        <Card title="Needs you" icon="tasks" onAll={() => navigate('/tasks')}>
          {myTasks.length === 0 ? <Empty text="Nothing assigned to you. Nice." /> : (
            <div>
              <div className="flex gap-4 mb-3">
                <Stat n={overdue.length} label="overdue" accent={overdue.length > 0} />
                <Stat n={dueToday.length} label="due today" />
                <Stat n={myTasks.length} label="open" />
              </div>
              <div className="space-y-1.5">
                {myTasks.slice(0, 3).map((t) => (
                  <button key={t.id} onClick={() => navigate(`/tasks?open=${t.id}`)} className="w-full flex items-center gap-2 text-left text-sm hover:text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    <span className="truncate flex-1">{t.title}</span>
                    {t.due_date && <span className="text-xs text-faint shrink-0">{prettyDate(t.due_date)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Open decisions */}
        <Card title="Open decisions" icon="trophy" onAll={() => navigate('/arena')}>
          {openArenas.length === 0 ? <Empty text="No pending decisions." /> : (
            <div className="space-y-1.5">
              {openArenas.slice(0, 4).map((a) => (
                <button key={a.id} onClick={() => navigate(`/arena?open=${a.id}`)} className="w-full flex items-center gap-2 text-left text-sm hover:text-accent">
                  <Icon name="trophy" size={14} className="text-faint shrink-0" />
                  <span className="truncate flex-1">{a.title}</span>
                  <span className="text-xs text-faint">decide →</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Brand bible completeness */}
        <Card title="Brand bible" icon="brand" onAll={() => navigate('/brand')}>
          <div className="flex items-center justify-between text-xs text-faint mb-1"><span>Completeness</span><span>{biblePct}%</span></div>
          <div className="h-1.5 bg-canvas rounded-full overflow-hidden mb-3"><div className="h-full bg-accent rounded-full" style={{ width: `${biblePct}%` }} /></div>
          <div className="flex flex-wrap gap-1.5">
            {checks.map((c) => (
              <button key={c.label} onClick={() => navigate(c.to)}
                className={`chip h-6 px-2 border ${c.ok ? 'border-line bg-canvas text-faint' : 'border-accent/40 bg-accent-soft text-accent'}`}>
                <Icon name={c.ok ? 'check' : 'plus'} size={11} /> {c.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Recent activity</h2>
          <button onClick={() => navigate('/feed')} className="text-sm text-muted hover:text-accent">Open feed →</button>
        </div>
        <div className="card divide-y divide-line">
          {data.activity.length === 0 ? <div className="p-5"><Empty text="Nothing yet — make a move." /></div> :
            data.activity.map((a) => {
              const actor = byId(a.actor)
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar profile={actor} size={28} />
                  <p className="text-sm flex-1 min-w-0 truncate">
                    <span className="font-medium">{actor.display_name}</span>{' '}
                    <span className="text-muted">{a.entity_type === 'post' ? a.body : a.summary}</span>
                  </p>
                  <span className="text-xs text-faint shrink-0">{timeAgo(a.created_at)}</span>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

function Card({ title, icon, onAll, children }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Icon name={icon} size={16} className="text-accent" /><h2 className="font-display text-base">{title}</h2></div>
        <button onClick={onAll} className="text-xs text-faint hover:text-accent">View all</button>
      </div>
      {children}
    </div>
  )
}
function Stat({ n, label, accent }) {
  return <div><div className={`font-display text-2xl ${accent && n > 0 ? 'text-accent' : ''}`}>{n}</div><div className="text-xs text-faint">{label}</div></div>
}
function Empty({ text }) { return <p className="text-sm text-faint py-2">{text}</p> }
