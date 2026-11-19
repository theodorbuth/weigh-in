import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'text'
}

export default function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles[variant], className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
