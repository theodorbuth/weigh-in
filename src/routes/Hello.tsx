import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import styles from './Hello.module.css'

export default function Hello() {
  return (
    <main className="centered">
      <h1 className={styles.title}>Hello world</h1>
      <Link to="/styles" className={styles.link}>
        Go to Hello styles
        <ArrowRight size={18} strokeWidth={1.7} aria-hidden />
      </Link>
    </main>
  )
}
