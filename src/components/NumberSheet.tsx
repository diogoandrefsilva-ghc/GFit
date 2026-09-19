import { useEffect, useState, type ReactNode } from 'react'
import { Stepper } from '@/components/Stepper'
import './number-sheet.css'

/**
 * Os números de um exercício — séries, repetições, descanso, tempo — mudam-se
 * num painel que sobe do fundo, com o exercício ainda à vista por trás.
 *
 * Em cima está o valor a mudar, com − e + para o afinar; em baixo, os valores
 * do costume à distância de um toque. O toque num deles vale por escolher e
 * fechar, que é o gesto de nove em cada dez vezes; quem precisa de um valor
 * fora da lista chega lá pelos botões sem mudar de sítio.
 */
function Sheet({
  title,
  caption,
  onClose,
  children,
}: {
  title: string
  caption?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Sem isto a lista de exercícios continua a deslizar por trás do painel.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="nsheet" role="dialog" aria-label={title}>
      <button
        type="button"
        className="nsheet__scrim"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="nsheet__panel">
        <div className="nsheet__grip" />
        <div className="nsheet__head">
          <span className="nsheet__text">
            <strong className="nsheet__title">{title}</strong>
            {caption && <em className="nsheet__caption">{caption}</em>}
          </span>
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={onClose}
          >
            Pronto
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Presets<T>({
  values,
  isOn,
  label,
  onPick,
}: {
  values: readonly T[]
  isOn: (value: T) => boolean
  label: (value: T) => string
  onPick: (value: T) => void
}) {
  return (
    <div className="nsheet__presets">
      <span className="nsheet__legend">Do costume</span>
      <div className="nsheet__grid">
        {values.map((value) => (
          <button
            key={label(value)}
            type="button"
            className={`nsheet__opt ${isOn(value) ? 'is-on' : ''}`}
            onClick={() => onPick(value)}
          >
            {label(value)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Um número só: séries, descanso, tempo de trabalho. */
export function NumberSheet({
  title,
  caption,
  value,
  presets,
  min,
  max,
  step = 1,
  format,
  hint,
  onChange,
  onClose,
}: {
  title: string
  caption?: string
  value: number
  presets: readonly number[]
  min: number
  max: number
  step?: number
  format: (value: number) => string
  hint?: string
  onChange: (value: number) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)

  /* Só se grava à saída: a fila de − e + de quem procura o número certo não
     tem de ser uma fila de gravações. */
  function close() {
    if (draft !== value) onChange(draft)
    onClose()
  }

  function pick(next: number) {
    if (next !== value) onChange(next)
    onClose()
  }

  return (
    <Sheet title={title} caption={caption} onClose={close}>
      <div className="nsheet__dial">
        <Stepper
          value={draft}
          onChange={setDraft}
          min={min}
          max={max}
          step={step}
          decimals={0}
          format={format}
          size="lg"
          label={title.toLowerCase()}
        />
      </div>
      <Presets
        values={presets}
        isOn={(option) => option === draft}
        label={format}
        onPick={pick}
      />
      {hint && <p className="nsheet__hint">{hint}</p>}
    </Sheet>
  )
}

export interface Range {
  min: number
  max: number
}

/** Duas pontas que se seguram uma à outra: o intervalo de repetições. */
export function RangeSheet({
  title,
  caption,
  value,
  presets,
  min,
  max,
  hint,
  onChange,
  onClose,
}: {
  title: string
  caption?: string
  value: Range
  presets: readonly Range[]
  min: number
  max: number
  hint?: string
  onChange: (value: Range) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const same = (a: Range, b: Range) => a.min === b.min && a.max === b.max

  function close() {
    if (!same(draft, value)) onChange(draft)
    onClose()
  }

  function pick(next: Range) {
    if (!same(next, value)) onChange(next)
    onClose()
  }

  return (
    <Sheet title={title} caption={caption} onClose={close}>
      <div className="nsheet__range">
        {/* O mínimo nunca passa o máximo: quem empurra um leva o outro atrás. */}
        <label className="nsheet__side">
          <span className="field__label">Mínimo</span>
          <Stepper
            value={draft.min}
            onChange={(next) =>
              setDraft({ min: next, max: Math.max(next, draft.max) })
            }
            min={min}
            max={max}
            step={1}
            decimals={0}
            label="repetições mínimas"
          />
        </label>
        <label className="nsheet__side">
          <span className="field__label">Máximo</span>
          <Stepper
            value={draft.max}
            onChange={(next) =>
              setDraft({ min: Math.min(next, draft.min), max: next })
            }
            min={min}
            max={max}
            step={1}
            decimals={0}
            label="repetições máximas"
          />
        </label>
      </div>
      <Presets
        values={presets}
        isOn={(option) => same(option, draft)}
        label={(option) =>
          option.min === option.max ? `${option.min}` : `${option.min}-${option.max}`
        }
        onPick={pick}
      />
      {hint && <p className="nsheet__hint">{hint}</p>}
    </Sheet>
  )
}
