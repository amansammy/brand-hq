import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'
import { can as canDo, isOwnerRole } from './permissions.js'
import { isAdmin } from './config.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setProfiles(data)
  }, [])

  useEffect(() => {
    if (!session) return
    loadProfiles()
    // Live-apply permission changes (admin editing a teammate's access).
    const ch = supabase.channel('profiles-perms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadProfiles)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [session, loadProfiles])

  const user = session?.user ?? null
  const me = profiles.find((p) => p.id === user?.id) || null
  // owner = explicit DB role, or the configured admin email before the row is set.
  const isOwner = isOwnerRole(me) || isAdmin(user)
  const can = useCallback((moduleKey, action) => canDo(me, moduleKey, action), [me])

  const value = {
    session,
    user,
    me,
    isOwner,
    can,
    loading,
    profiles,
    loadProfiles,
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
