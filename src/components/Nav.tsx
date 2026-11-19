import { Link } from 'react-router'
import balanceScale from '../assets/balance-scale.svg'
import Avatar from './Avatar'
import styles from './Nav.module.css'

interface NavProps {
  /** Signed-in person's display name. Omit to hide the viewer. */
  viewerName?: string
}

export default function Nav({ viewerName }: NavProps) {
  return (
    <header className={styles.nav}>
      <Link to="/" className={styles.wordmark}>
        <img src={balanceScale} width={34} height={30} alt="" />
        Weigh In
      </Link>
      {viewerName && (
        <div className={styles.viewer}>
          <Avatar name={viewerName} />
          <span>{viewerName}</span>
        </div>
      )}
    </header>
  )
}
