import { useState, useRef } from 'react'
import { supabase, uploadPublicImage } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Modal, Avatar } from './ui.jsx'
import { Icon } from '../lib/icons.jsx'

export default function ProfileSettings({ onClose }) {
  const { user, profiles, loadProfiles, signOut } = useAuth()
  const me = profiles.find((p) => p.id === user?.id) || { id: user?.id, display_name: user?.email }
  const [name, setName] = useState(me.display_name || '')
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState(me.avatar_url || null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef()

  function chooseAvatar(e) {
    const f = e.target.files?.[0]
    if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)) }
  }

  async function save() {
    setBusy(true)
    try {
      let patch = { display_name: name.trim() || me.display_name }
      if (avatar) { const { url } = await uploadPublicImage('brand', avatar, 'avatars'); patch.avatar_url = url }
      await supabase.from('profiles').update(patch).eq('id', user.id)
      await loadProfiles()
      onClose()
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Your profile"
      footer={<>
        <button onClick={signOut} className="btn btn-ghost text-accent border-accent-soft mr-auto"><Icon name="logout" size={15} /> Sign out</button>
        <button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="flex items-center gap-4 mb-5">
        <div className="relative">
          {preview ? <img src={preview} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Avatar profile={{ ...me, display_name: name }} size={64} />}
          <button onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-on-accent grid place-items-center border-2 border-surface">
            <Icon name="edit" size={13} />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={chooseAvatar} />
        </div>
        <div className="text-sm text-muted">Tap the pencil to change your photo.</div>
      </div>
      <div>
        <label className="label">Display name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <p className="text-xs text-faint mt-1">This is how you appear in the feed, mentions, and assignments.</p>
      </div>
    </Modal>
  )
}
