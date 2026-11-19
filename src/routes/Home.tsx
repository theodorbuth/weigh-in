import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import heroScale from '../assets/balance-scale-hero.svg'
import Nav from '../components/Nav'
import TeamPile, { PILE_BASE, PILE_TAPER } from '../components/TeamPile'
import { useAuth } from '../lib/auth'
import { formatHours } from '../lib/format'
import { loadHome, type HomeProject } from '../lib/home'
import { fitUnit } from '../lib/pitLayout'
import styles from './Home.module.css'

const PILE_W = 300
const PILE_H = 130

/** Figma "Home · Option A · Scale": decorative scale, one card per project with a combined pile. */
export default function Home() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<HomeProject[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHome()
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
  }, [])

  // One stone scale for every card, so piles are comparable across projects.
  const unit = projects
    ? fitUnit(projects.map((p) => p.pile), { width: PILE_W * PILE_BASE, height: PILE_H - 9, max: 34, taper: PILE_TAPER })
    : 34

  return (
    <>
      <Nav viewerName={profile?.name ?? undefined} />
      <main className={styles.main}>
        <h1 className={styles.title}>Projects</h1>
        <img className={styles.hero} src={heroScale} width={1050} height={298} alt="" />

        {error && <p className={styles.status}>Couldn’t load your projects: {error}</p>}
        {!projects && !error && <p className={styles.status}>Loading…</p>}

        {projects && (
          <div className={styles.grid}>
            {projects.map((p) => (
              <Link key={p.id} to={`/p/${p.id}`} className={styles.card}>
                <div>
                  <h2 className={styles.name}>{p.name}</h2>
                  <p className={styles.meta}>
                    {p.teamSize} {p.teamSize === 1 ? 'person' : 'people'} · {formatHours(p.hoursWorked)} worked
                    {p.collecting && ' · check-in open'}
                  </p>
                </div>
                <TeamPile
                  stones={p.pile}
                  unit={unit}
                  width={PILE_W}
                  height={PILE_H}
                  grey={p.collecting}
                  emptyText="Stones appear here after your first reveal."
                />
                <div className={styles.footer}>
                  <div className={styles.avatars} aria-label={p.members.map((m) => m.name).join(', ')}>
                    {p.members.slice(0, 6).map((m) => (
                      <span key={m.id} title={m.name}>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <ArrowRight size={18} strokeWidth={1.7} aria-hidden />
                </div>
              </Link>
            ))}

            <section className={styles.add}>
              <h2 className={styles.name}>Add project</h2>
              <div className={styles.addActions}>
                <Link to="/new" className={styles.primary}>
                  Create new project
                </Link>
                <Link to="/join" className={styles.secondary}>
                  Join with code
                </Link>
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  )
}
