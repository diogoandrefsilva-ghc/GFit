import { num } from '@/lib/format'
import './stepper.css'

interface Props {
  value: number | null
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  decimals?: number
  unit?: string
  fallback?: number
  size?: 'md' | 'lg'
  label?: string
  /** Formatação alternativa do valor — ex.: 7,25 mostrado como "7h 15". */
  format?: (value: number) => string
}

/**
 * Entrada numérica com − e +. Num ginásio mexe-se nisto com uma mão só, por
 * isso os alvos são grandes e não há teclado pelo meio.
 */
export function Stepper({
  value,
  onChange,
  step = 0.1,
  min = 0,
  max = 999,
  decimals = 1,
  unit,
  fallback = 0,
  size = 'md',
  label,
  format,
}: Props) {
  const current = value ?? fallback

  function shift(direction: 1 | -1) {
    const next = Math.round((current + direction * step) * 1000) / 1000
    onChange(Math.min(max, Math.max(min, next)))
  }

  return (
    <div className={`stepper stepper--${size}`}>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => shift(-1)}
        disabled={current <= min}
        aria-label={label ? `Diminuir ${label}` : 'Diminuir'}
      >
        −
      </button>
      <span className="stepper__value">
        {format ? format(current) : num(current, decimals)}
        {unit && <em className="stepper__unit">{unit}</em>}
      </span>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => shift(1)}
        disabled={current >= max}
        aria-label={label ? `Aumentar ${label}` : 'Aumentar'}
      >
        +
      </button>
    </div>
  )
}
