import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, EmptyState, Spinner, PageHeader } from '../components/ui.jsx'
import { Reactions, Comments } from '../components/Discussion.jsx'
import { Icon } from '../lib/icons.jsx'
import { timeAgo } from '../lib/util.js'

const VERB_ICON = {
  posted: 'feed', created: 'plus', updated: 'edit', uploaded: 'upload',
  completed: 'check', added: 'plus', deleted: 'trash',
}

export default function Feed() {
  const { user, profiles } = useAuth()
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' },
        (payload) => setItems((cur) => [payload.new, ...cur.filter((i) => i.id !== payload.new.id)]))
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

  return (
    <div>
      <PageHeader title="Feed" subtitle="Everything happening in the brand, as it happens." />

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
            return (
              <div key={a.id} className="card p-4 animate-in">
                <div className="flex gap-3">
                  <Avatar profile={actor} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{actor.display_name}</span>
                      {!isPost && (
                        <span className="text-sm text-muted flex items-center gap-1">
                          <Icon name={VERB_ICON[a.verb] || 'feed'} size={14} className="text-faint" />
                          {a.summary}
                        </span>
                      )}
                      <span className="text-xs text-faint">· {timeAgo(a.created_at)}</span>
                    </div>

                    {isPost && a.body && (
                      <p className="text-[15px] leading-relaxed mt-1.5 whitespace-pre-wrap break-words">{a.body}</p>
                    )}
                    {!isPost && a.body && (
                      <p className="text-sm text-muted mt-1 whitespace-pre-wrap break-words">{a.body}</p>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <Reactions entityType="activity" entityId={a.id} />
                      <button
                        onClick={() => setOpenComments((o) => ({ ...o, [a.id]: !o[a.id] }))}
                        className="h-7 px-2 rounded-full text-xs flex items-center gap-1 text-muted hover:text-ink border border-line hover:border-line-strong">
                        <Icon name="comment" size={14} /> Comment
                      </button>
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
