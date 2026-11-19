import { UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import CopyField from '../components/CopyField'
import Nav from '../components/Nav'
import { useAuth } from '../lib/auth'
import { joinLink } from '../lib/joinLink'
import { useProject } from '../lib/project'
import type { ProjectContext } from '../lib/projectContext'
import styles from './ProjectLayout.module.css'

/** Shared frame for /p/:projectId (My stones) and /p/:projectId/team. Holds the live connection. */
export default function ProjectLayout() {
  const { profile } = useAuth()
  const { projectId } = useParams()
  const { data, error, reload } = useProject(Number(projectId))
  const [inviteOpen, setInviteOpen] = useState(false)
  const inviteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!inviteOpen) return
    const close = (e: MouseEvent) => !inviteRef.current?.contains(e.target as Node) && setInviteOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [inviteOpen])

  return (
    <>
      <Nav viewerName={profile?.name ?? undefined} />
      <main className={styles.main}>
        {error && <p className={styles.status}>Couldn’t load this project: {error}</p>}
        {data === undefined && !error && <p className={styles.status}>Loading…</p>}
        {data === null && (
          <p className={styles.status}>
            This project doesn’t exist or you’re not a member. <Link to="/">Back to your projects</Link>
          </p>
        )}
        {data && profile && (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>{data.project.name}</h1>
              <div className={styles.right} ref={inviteRef}>
                <button type="button" className={styles.invite} onClick={() => setInviteOpen((o) => !o)} aria-expanded={inviteOpen}>
                  <UserPlus size={16} strokeWidth={1.7} aria-hidden />
                  Invite
                </button>
                {inviteOpen && (
                  <div className={styles.invitePanel} role="dialog" aria-label="Invite teammates">
                    Send teammates the join link and the password.
                    <div className={styles.inviteRow}>
                      <div>
                        Join link
                        <CopyField
                          value={data.project.invite_code}
                          copyText={joinLink(data.project.invite_code)}
                          label="Copy join link"
                          copiedText="Link copied"
                        />
                      </div>
                      <div>
                        Password
                        <CopyField value={data.project.password ?? ''} label="Copy password" secret />
                      </div>
                    </div>
                  </div>
                )}
                <NavLink to="team" className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
                  Team
                </NavLink>
                <NavLink end to="." className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
                  My stones
                </NavLink>
              </div>
            </header>
            <Outlet context={{ data, reload, me: profile.id } satisfies ProjectContext} />
          </>
        )}
      </main>
    </>
  )
}
