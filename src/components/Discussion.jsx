import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar } from './ui.jsx'
import MentionInput, { MentionText } from './MentionInput.jsx'
import { notify, parseMentions } from '../lib/notify.js'
import { entityLink } from '../lib/config.js'
import { Icon } from '../lib/icons.jsx'
import { timeAgo } from '../lib/util.js'

const EMOJIS = ['👍', '❤️', '🔥', '👀']

export function Reactions({ entityType, entityId, showVoters }) {
  const { user, profiles } = useAuth()
  const [rows, setRows] = useState([])
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: '?' }

  const load = useCallback(async () => {
    const { data } = await supabase.from('reactions').select('*')
      .eq('entity_type', entityType).eq('entity_id', entityId)
    setRows(data || [])
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  async function toggle(emoji) {
    const mine = rows.find((r) => r.user_id === user.id && r.emoji === emoji)
    if (mine) {
      await supabase.from('reactions').delete().eq('id', mine.id)
    } else {
      await supabase.from('reactions').insert({ entity_type: entityType, entity_id: entityId, emoji, user_id: user.id })
    }
    load()
  }

  const counts = EMOJIS.map((e) => ({
    emoji: e,
    count: rows.filter((r) => r.emoji === e).length,
    mine: rows.some((r) => r.user_id === user.id && r.emoji === e),
  }))

  const voters = [...new Set(rows.map((r) => r.user_id))]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {counts.map(({ emoji, count, mine }) => (
          <button key={emoji} onClick={() => toggle(emoji)}
            className={`h-7 px-2 rounded-full text-xs flex items-center gap-1 border transition-colors ${
              mine ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
            } ${count === 0 ? 'opacity-60' : ''}`}>
            <span>{emoji}</span>{count > 0 && <span className="font-medium">{count}</span>}
          </button>
        ))}
      </div>
      {showVoters && voters.length > 0 && (
        <div className="flex items-center -space-x-1.5" title="Voted">
          {voters.map((id) => <div key={id} className="ring-2 ring-surface rounded-full"><Avatar profile={byId(id)} size={20} /></div>)}
        </div>
      )}
    </div>
  )
}

export function Comments({ entityType, entityId, compact }) {
  const { user, profiles } = useAuth()
  const [rows, setRows] = useState([])
  const [text, setText] = useState('')
  const byId = (id) => profiles.find((p) => p.id === id) || { id, display_name: '…' }

  const load = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*')
      .eq('entity_type', entityType).eq('entity_id', entityId)
      .order('created_at', { ascending: true })
    setRows(data || [])
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    const body = text.trim()
    setText('')
    await supabase.from('comments').insert({ entity_type: entityType, entity_id: entityId, body, created_by: user.id })
    const meName = profiles.find((p) => p.id === user.id)?.display_name || 'Someone'
    const link = entityType === 'activity' ? '/feed' : (entityLink(entityType, entityId) || null)
    const mentioned = parseMentions(body, profiles)
    const others = profiles.map((p) => p.id).filter((id) => id !== user.id && !mentioned.includes(id))
    await notify({ userIds: mentioned, actor: user.id, type: 'mention', body: `${meName} mentioned you in a comment`, link })
    await notify({ userIds: others, actor: user.id, type: 'comment', body: `${meName} commented`, link })
    load()
  }

  return (
    <div className={compact ? '' : 'mt-1'}>
      {rows.length > 0 && (
        <div className="space-y-3 mb-3">
          {rows.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar profile={byId(c.created_by)} size={26} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{byId(c.created_by).display_name}</span>
                  <span className="text-xs text-faint">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-ink/90 whitespace-pre-wrap break-words"><MentionText text={c.body} profiles={profiles} /></p>
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={send} className="flex items-center gap-2">
        <MentionInput profiles={profiles} className="input h-9 text-sm" placeholder="Write a comment…  (@ to mention)"
          value={text} onChange={setText} />
        <button className="btn btn-soft h-9 px-3 shrink-0" disabled={!text.trim()}>
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  )
}
