import './scale.css'

interface Props {
  value: number | null
  onChange: (value: number) => void
  max?: number
  label: string
  hint?: string
  tone?: 'ink' | 'accent'
}

/** Escala 1-5 (energia, fome, stress) ou 1-10 (motivação). */
export function Scale({
  value,
  onChange,
  max = 5,
  label,
  hint,
  tone = 'ink',
}: Props) {
  const steps = Array.from({ length: max }, (_, index) => index + 1)

  return (
    <div className="scale">
      <div className="scale__head">
        <span className="field__label">{label}</span>
        {hint && <span className="scale__hint">{hint}</span>}
      </div>
      <div className="scale__row" role="group" aria-label={label}>
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            className={`scale__dot scale__dot--${tone} ${
              value === step ? 'is-on' : ''
            }`}
            onClick={() => onChange(step)}
            aria-pressed={value === step}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  )
}
