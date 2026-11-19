import submittedIndicator from '../assets/submitted-indicator.svg'
import styles from './Avatar.module.css'

interface AvatarProps {
  name: string
  /** Shows the green dot (sealed / agreed). */
  confirmed?: boolean
}

export default function Avatar({ name, confirmed = false }: AvatarProps) {
  return (
    <span className={styles.avatar} title={name}>
      {name.trim().charAt(0).toUpperCase()}
      {confirmed && (
        <img
          className={styles.indicator}
          src={submittedIndicator}
          width={14}
          height={14}
          alt="Confirmed"
        />
      )}
    </span>
  )
}
