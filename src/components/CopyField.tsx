import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import styles from './CopyField.module.css'

interface CopyFieldProps {
  /** What's shown, e.g. WGH-4821. */
  value: string
  /** What's copied (defaults to the shown value), e.g. the full join link. */
  copyText?: string
  label: string
  /** Hide the value behind dots with a show/hide toggle (for passwords). */
  secret?: boolean
  /** Text shown after copying. */
  copiedText?: string
}

export default function CopyField({ value, copyText, label, secret = false, copiedText = 'Copied' }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(!secret)

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText ?? value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked (e.g. http); the value is still visible to copy by hand.
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.value}>{!value ? '…' : shown ? value : '•'.repeat(Math.min(value.length, 12))}</span>
      <span className={styles.buttons}>
        {secret && (
          <button type="button" className={styles.copy} onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide' : 'Show'}>
            {shown ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
          </button>
        )}
        <button type="button" className={`${styles.copy} ${copied ? styles.copied : ''}`} onClick={copy} aria-label={label} disabled={!value}>
          {copied ? <Check size={18} strokeWidth={1.7} /> : <Copy size={18} strokeWidth={1.7} />}
          {copied && copiedText}
        </button>
      </span>
    </div>
  )
}
