import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type Profile } from './auth'
import { supabase } from './supabase'

async function fetchProfile(authId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('auth_id', authId)
    .maybeSingle()
  if (error) throw error
  return data
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (next: Session | null) => {
    setSession(next)
    try {
      setProfile(next ? await fetchProfile(next.user.id) : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Token refreshes don't change who is signed in; skip refetching for them.
      if (event === 'TOKEN_REFRESHED') return setSession(next)
      // Deferred: Supabase advises against awaiting other Supabase calls inside this callback.
      setTimeout(() => void load(next), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const refreshProfile = useCallback(async () => {
    if (session) setProfile(await fetchProfile(session.user.id))
  }, [session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ loading, session, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
