import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, PageHeader, Spinner } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { MODULES, ROLE_PRESETS, presetPermissions, summarize } from '../lib/permissions.js'

const PRESET_ORDER = ['full', 'editor', 'contributor', 'viewer', 'custom']

export default function Admin() {
  const { user, profiles, loadProfiles } = useAuth()

  if (!profiles.length) return <Spinner />

  // Show the owner(s) first, then everyone else.
  const sorted = [...profiles].sort((a, b) => (b.role === 'owner') - (a.role === 'owner'))

  return (
    <div>
      <PageHeader title="Permissions" subtitle="Decide exactly what each teammate can see and do." />

      <div className="card p-4 mb-5 flex items-start gap-3 text-sm text-muted">
        <Icon name="shield" size={18} className="text-accent shrink-0 mt-0.5" />
        <p>
          Pick a role for a quick setup, or tick individual permissions for fine-grained control.
          Changes apply instantly and are enforced both in the app and in the database — a teammate
          without a permission can&apos;t do it even by other means.
        </p>
      </div>

      <div className="space-y-4">
        {sorted.map((p) => (
          <UserCard key={p.id} profile={p} isSelf={p.id === user.id} onSaved={loadProfiles} />
        ))}
      </div>
    </div>
  )
}

function UserCard({ profile, isSelf, onSaved }) {
  const owner = profile.role === 'owner'
  const [role, setRole] = useState(profile.role || 'full')
  const [perms, setPerms] = useState(() =>
    role === 'owner' || role === 'full' ? presetPermissions('full') : (profile.permissions || {}))
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('idle') // idle | saving | saved
  const locked = owner || isSelf

  const dirty = role !== (profile.role || 'full') ||
    JSON.stringify(perms) !== JSON.stringify(profile.permissions || {})

  function choosePreset(r) {
    setRole(r)
    if (r !== 'custom') setPerms(presetPermissions(r))
    setState('idle')
  }

  function toggle(moduleKey, action) {
    setPerms((cur) => {
      const next = { ...cur }
      const arr = new Set(next[moduleKey] || [])
      if (arr.has(action)) arr.delete(action); else arr.add(action)
      if (arr.size) next[moduleKey] = [...arr]; else delete next[moduleKey]
      return next
    })
    setRole('custom')
    setState('idle')
  }

  const has = (m, a) => (perms[m] || []).includes(a)

  async function save() {
    setState('saving')
    const payload = role === 'full'
      ? { role: 'full', permissions: {} }
      : { role, permissions: perms }
    const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id)
    setState(error ? 'idle' : 'saved')
    if (!error) onSaved?.()
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate flex items-center gap-2">
            {profile.display_name || 'Teammate'}
            {owner && <span className="text-[11px] font-semibold text-accent inline-flex items-center gap-1"><Icon name="lock" size={12} /> Owner</span>}
            {isSelf && !owner && <span className="text-[11px] text-faint">(you)</span>}
          </p>
          <p className="text-xs text-muted">{summarize({ role, permissions: perms })}</p>
        </div>
        {!locked && (
          <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost text-sm">
            <Icon name="settings" size={15} /> {open ? 'Hide' : 'Edit access'}
          </button>
        )}
      </div>

      {locked ? (
        <p className="text-xs text-faint mt-3">
          {owner ? 'The owner always has full control and can’t be restricted.' : 'You can’t change your own access here.'}
        </p>
      ) : open && (
        <div className="mt-4 pt-4 border-t border-line animate-in">
          {/* Role presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESET_ORDER.map((r) => (
              <button key={r} onClick={() => choosePreset(r)}
                title={ROLE_PRESETS[r].desc}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  role === r ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-line-strong'
                }`}>
                {ROLE_PRESETS[r].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mb-4">{ROLE_PRESETS[role]?.desc}</p>

          {/* Permission matrix */}
          <div className="space-y-2">
            {MODULES.map((m) => (
              <div key={m.key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2 border-b border-line/60 last:border-0">
                <div className="flex items-center gap-2 w-40 shrink-0 text-sm font-medium">
                  <Icon name={m.icon} size={15} className="text-faint" /> {m.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.actions.map(([a, label]) => (
                    <button key={a} onClick={() => toggle(m.key, a)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        has(m.key, a) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-faint hover:border-line-strong'
                      }`}>
                      {has(m.key, a) && <Icon name="check" size={11} className="inline -mt-0.5 mr-0.5" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            {state === 'saved' && !dirty && <span className="text-xs text-green-600 flex items-center gap-1"><Icon name="check" size={14} /> Saved</span>}
            <button onClick={save} disabled={!dirty || state === 'saving'} className="btn btn-primary">
              {state === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
