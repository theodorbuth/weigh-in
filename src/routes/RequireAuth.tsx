import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth'

/**
 * Wraps every page that needs a signed-in person with a name.
 * Signed out → /login?next=<here>.  No name yet → /welcome?next=<here>.
 * `next` keeps join links working: /join/WGH-4821 → sign in → back to the join page.
 */
export default function RequireAuth() {
  const { loading, session, profile } = useAuth()
  const location = useLocation()
  const here = location.pathname + location.search

  if (loading) return null
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />
  if (!profile?.name && location.pathname !== '/welcome') {
    return <Navigate to={`/welcome?next=${encodeURIComponent(here)}`} replace />
  }
  return <Outlet />
}
