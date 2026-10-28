import { useState } from 'react'
import { num, parseDecimal } from '@/lib/format'
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
  /**
   * O valor também se escreve: um toque no número abre o teclado. Serve a
   * carga, onde ir de 20 a 80 kg às pancadas no + não é maneira.
   */
  typeable?: boolean
}

/**
 * Entrada numérica com − e +. Num ginásio mexe-se nisto com uma mão só, por
 * isso os alvos são grandes e o teclado só aparece a quem tocar no número
 * (com `typeable`).
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
  typeable = false,
}: Props) {
  const current = value ?? fallback
  const [typing, setTyping] = useState<string | null>(null)

  function commit() {
    const parsed = typing === null ? null : parseDecimal(typing)
    setTyping(null)
    if (parsed === null) return
    const rounded = Math.round(parsed * 10 ** decimals) / 10 ** decimals
    onChange(Math.min(max, Math.max(min, rounded)))
  }

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
      {typing !== null ? (
        <span className="stepper__value">
          <input
            className="stepper__input"
            type="text"
            inputMode={decimals > 0 ? 'decimal' : 'numeric'}
            autoFocus
            value={typing}
            aria-label={label ? `Escrever ${label}` : 'Escrever valor'}
            onChange={(event) => setTyping(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') setTyping(null)
            }}
          />
          {unit && <em className="stepper__unit">{unit}</em>}
        </span>
      ) : typeable ? (
        <button
          type="button"
          className="stepper__value stepper__value--typeable"
          onClick={() => setTyping(num(current, decimals))}
          aria-label={label ? `Escrever ${label}` : 'Escrever valor'}
        >
          {format ? format(current) : num(current, decimals)}
          {unit && <em className="stepper__unit">{unit}</em>}
        </button>
      ) : (
        <span className="stepper__value">
          {format ? format(current) : num(current, decimals)}
          {unit && <em className="stepper__unit">{unit}</em>}
        </span>
      )}
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
