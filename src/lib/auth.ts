import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/** The signed-in person's row in public.users (found by email when they first signed in). */
export interface Profile {
  id: number
  name: string | null
  email: string
}

export interface AuthState {
  /** True until we know whether someone is signed in. */
  loading: boolean
  session: Session | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Only allow same-site paths as a post-sign-in destination (no open redirects). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/home'
}
