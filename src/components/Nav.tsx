import { ChevronDown, Globe, LogOut, Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import balanceScale from '../assets/balance-scale.svg'
import { useAuth } from '../lib/auth'
import Avatar from './Avatar'
import styles from './Nav.module.css'

interface NavProps {
  /** Signed-in person's display name. Omit to hide the viewer. */
  viewerName?: string
}

/** Top bar. Clicking your name opens a small menu: Hello world, Hello styles, Log out. */
export default function Nav({ viewerName }: NavProps) {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function logOut() {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.nav}>
      <Link to="/" className={styles.wordmark}>
        <img src={balanceScale} width={34} height={30} alt="" />
        Weigh In
      </Link>
      {viewerName && (
        <div className={styles.account} ref={menu}>
          <button
            type="button"
            className={styles.viewer}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Avatar name={viewerName} />
            <span>{viewerName}</span>
            <ChevronDown size={16} strokeWidth={1.7} className={open ? styles.flip : ''} aria-hidden />
          </button>
          {open && (
            <div className={styles.menu} role="menu">
              <Link to="/hello" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                <Globe size={18} strokeWidth={1.7} aria-hidden />
                Hello world
              </Link>
              <Link to="/styles" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                <Palette size={18} strokeWidth={1.7} aria-hidden />
                Hello styles
              </Link>
              {session && (
                <>
                  <hr className={styles.divider} />
                  <button type="button" className={styles.item} role="menuitem" onClick={logOut}>
                    <LogOut size={18} strokeWidth={1.7} aria-hidden />
                    Log out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
