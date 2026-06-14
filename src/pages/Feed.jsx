import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { isAdmin, entityLink } from '../lib/config.js'
import { Avatar, EmptyState, Spinner, PageHeader } from '../components/ui.jsx'
import { Reactions, Comments } from '../components/Discussion.jsx'
import { Icon } from '../lib/icons.jsx'
import { timeAgo } from '../lib/util.js'

const VERB_ICON = {
  posted: 'feed', created: 'plus', updated: 'edit', uploaded: 'upload',
  completed: 'check', added: 'plus', deleted: 'trash',
}
const TYPE_ICON = {
  task: 'tasks', file: 'files', note: 'notes', moodboard: 'mood',
  collection: 'drops', garment: 'drops', arena: 'trophy', candidate: 'trophy',
  brand_bible: 'brand', post: 'feed',
}

export default function Feed() {
  const { user, profiles } = useAuth()
  const navigate = useNavigate()
  const admin = isAdmin(user)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [openComments, setOpenComments] = useState({})
  const me = profiles.find((p) => p.id === user?.id)
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: 'Someone' }

  const load = useCallback(async () => {
    const { data } = await supabase.from('activity').select('*')
      .order('created_at', { ascending: false }).limit(100)
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function post(e) {
    e.preventDefault()
    if (!text.trim()) return
    setPosting(true)
    await logActivity({ verb: 'posted', entity_type: 'post', body: text.trim() })
    setText(''); setPosting(false)
  }

  async function removeItem(id) {
    await supabase.from('activity').delete().eq('id', id)
    setItems((cur) => cur.filter((i) => i.id !== id))
  }
  async function clearFeed() {
    if (!confirm('Clear the entire activity feed? This removes all feed items (your notes, files, tasks etc. stay).')) return
    await supabase.from('activity').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setItems([])
  }

  return (
    <div>
      <PageHeader title="Feed" subtitle="Everything happening in the brand, as it happens."
        action={admin && items.length > 0 && (
          <button onClick={clearFeed} className="btn btn-ghost text-accent border-accent-soft">
            <Icon name="trash" size={15} /> Clear feed
          </button>
        )} />

      {/* Composer */}
      <div className="card p-4 mb-6">
        <form onSubmit={post}>
          <div className="flex gap-3">
            <Avatar profile={me} size={36} />
            <textarea className="input min-h-[44px] py-2.5" rows={text ? 3 : 1}
              placeholder="Share an update, a question, a decision…"
              value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {text.trim() && (
            <div className="flex justify-end mt-3 animate-in">
              <button className="btn btn-primary" disabled={posting}>
                <Icon name="send" size={16} /> {posting ? 'Posting…' : 'Post update'}
              </button>
            </div>
          )}
        </form>
      </div>

      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="feed" title="Nothing here yet"
          subtitle="Post the first update, or create a task or upload a file — it'll all show up right here." />
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const actor = byId(a.actor)
            const isPost = a.entity_type === 'post'
            const link = isPost ? null : entityLink(a.entity_type, a.entity_id, a.meta || {})
            const thumb = a.meta?.thumb_url
            const goto = () => link && navigate(link)
            return (
              <div key={a.id} className="card p-4 animate-in group">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  {!isPost && (
                    <button onClick={goto} disabled={!link}
                      className={`h-11 w-11 rounded-xl overflow-hidden shrink-0 border border-line grid place-items-center ${link ? 'cursor-pointer hover:border-line-strong' : ''} ${thumb ? '' : 'bg-accent-soft text-accent'}`}>
                      {thumb
                        ? <img src={thumb} alt="" className="h-full w-full object-cover" />
                        : <Icon name={TYPE_ICON[a.entity_type] || 'feed'} size={20} />}
                    </button>
                  )}
                  {isPost && <Avatar profile={actor} size={36} />}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{actor.display_name}</span>
                      {!isPost && (
                        <button onClick={goto} disabled={!link}
                          className={`text-sm text-muted flex items-center gap-1 ${link ? 'hover:text-accent' : ''}`}>
                          <Icon name={VERB_ICON[a.verb] || 'feed'} size={14} className="text-faint" />
                          {a.summary}
                        </button>
                      )}
                      <span className="text-xs text-faint">· {timeAgo(a.created_at)}</span>
                      {admin && (
                        <button onClick={() => removeItem(a.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-faint hover:text-accent transition-opacity"
                          title="Remove from feed">
                          <Icon name="close" size={15} />
                        </button>
                      )}
                    </div>

                    {isPost && a.body && (
                      <p className="text-[15px] leading-relaxed mt-1.5 whitespace-pre-wrap break-words">{a.body}</p>
                    )}
                    {!isPost && a.body && (
                      <p className="text-sm text-muted mt-1 whitespace-pre-wrap break-words">{a.body}</p>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <Reactions entityType="activity" entityId={a.id} />
                      <button onClick={() => setOpenComments((o) => ({ ...o, [a.id]: !o[a.id] }))}
                        className="h-7 px-2 rounded-full text-xs flex items-center gap-1 text-muted hover:text-ink border border-line hover:border-line-strong">
                        <Icon name="comment" size={14} /> Comment
                      </button>
                      {link && (
                        <button onClick={goto} className="h-7 px-2 rounded-full text-xs flex items-center gap-1 text-muted hover:text-accent border border-line hover:border-line-strong">
                          Open <Icon name="chevronDown" size={13} className="-rotate-90" />
                        </button>
                      )}
                    </div>

                    {openComments[a.id] && (
                      <div className="mt-3 pt-3 border-t border-line animate-in">
                        <Comments entityType="activity" entityId={a.id} compact />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
