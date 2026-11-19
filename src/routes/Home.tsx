import { Link } from 'react-router'
import Button from '../components/Button'
import styles from '../components/Card.module.css'
import Nav from '../components/Nav'
import { useAuth } from '../lib/auth'

// Temporary signed-in landing page. The real Home (project cards with team piles) comes later.
export default function Home() {
  const { profile, signOut } = useAuth()
  return (
    <>
      <Nav viewerName={profile?.name ?? undefined} />
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Hi {profile?.name}</h1>
          <p className={styles.subtitle}>
            Signed in as {profile?.email} (users.id {profile?.id})
          </p>
          <p className={styles.switch}>
            <Link to="/styles">Hello styles</Link>
          </p>
          <Button className={styles.submit} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </main>
    </>
  )
}
