import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './screen.css'

interface HeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  back?: boolean | (() => void)
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  back,
}: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="screen-head">
      {back && (
        <button
          type="button"
          className="screen-head__back"
          onClick={() => (typeof back === 'function' ? back() : navigate(-1))}
          aria-label="Voltar"
        >
          ←
        </button>
      )}
      <div className="screen-head__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="title">{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {action && <div className="screen-head__action">{action}</div>}
    </header>
  )
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {label && <span className="sr-only">{label}</span>}
    </div>
  )
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <strong className="empty__title">{title}</strong>
      {hint && <p className="empty__hint">{hint}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'good' | 'accent'
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__label">{label}</span>
      <strong className="stat__value">{value}</strong>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  )
}
