import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import styles from '../components/Card.module.css'
import CopyField from '../components/CopyField'
import Nav from '../components/Nav'
import StoneTrio from '../components/StoneTrio'
import { useAuth } from '../lib/auth'
import { joinLink } from '../lib/joinLink'
import { supabase } from '../lib/supabase'

interface ProjectInfo {
  name: string
  invite_code: string
  password: string | null
  team_size: number
  members: { users: { name: string | null } | null }[]
}

// Temporary project page: shows the join link to share. My stones / Team view come next.
export default function Project() {
  const { profile } = useAuth()
  const { projectId } = useParams()
  const [project, setProject] = useState<ProjectInfo | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('projects')
      .select('name, invite_code, password, team_size, members(users(name))')
      .eq('id', Number(projectId))
      .maybeSingle()
      .then(({ data }) => setProject((data as unknown as ProjectInfo) ?? null))
  }, [projectId])

  return (
    <>
      <Nav viewerName={profile?.name ?? undefined} />
      <main className={styles.page}>
        <div className={styles.card}>
          <StoneTrio />
          {project === undefined && <p className={styles.subtitle}>Loading…</p>}
          {project === null && (
            <>
              <h1 className={styles.title}>Project not found</h1>
              <p className={styles.switch}>
                It doesn’t exist or you’re not a member. <Link to="/">Back to projects</Link>
              </p>
            </>
          )}
          {project && (
            <>
              <h1 className={styles.title}>{project.name}</h1>
              <p className={styles.subtitle}>
                {project.members.map((m) => m.users?.name ?? '?').join(', ')}
              </p>
              <p className={styles.hint} style={{ marginTop: 0 }}>
                Invite teammates: send them the join link and the password.
              </p>
              <div className={styles.row}>
                <div className={styles.field}>
                  Join link
                  <CopyField
                    value={project.invite_code}
                    copyText={joinLink(project.invite_code)}
                    label="Copy join link"
                    copiedText="Link copied"
                  />
                </div>
                <div className={styles.field}>
                  Password
                  <CopyField value={project.password ?? ''} label="Copy password" secret />
                </div>
              </div>
              <p className={styles.switch}>
                My stones and the Team view are coming next. <Link to="/">Back to projects</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </>
  )
}
