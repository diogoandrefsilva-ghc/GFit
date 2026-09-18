import { useMemo, useState } from 'react'
import { BodyMap } from '@/components/BodyMap'
import type { Muscle } from '@/lib/database.types'
import './body-map.css'

interface Props {
  muscles: Muscle[]
  /** O slug escolhido, ou `null` para todos. */
  value: string | null
  onChange: (slug: string | null) => void
  /** Na biblioteca abre logo; no painel de escolha fica fechado, que o espaço é pouco. */
  defaultOpen?: boolean
}

/**
 * Escolher o músculo a filtrar tocando-lhe no corpo. Quinze nomes numa fila de
 * chips obrigavam a arrastar de lado e a saber como se chama o que se procura;
 * no desenho aponta-se.
 */
export function MuscleFilter({ muscles, value, onChange, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const names = useMemo(
    () => new Map(muscles.map((muscle) => [muscle.slug, muscle.name])),
    [muscles],
  )

  // Só o escolhido acende. Sem escolha, o corpo fica todo neutro.
  const intensities = useMemo(
    () => (value ? new Map([[value, 1]]) : new Map<string, number>()),
    [value],
  )

  const pick = (slug: string) => onChange(slug === value ? null : slug)

  return (
    <div className={`muscle-filter ${open ? 'is-open' : ''}`}>
      <div className="muscle-filter__bar">
        <button
          type="button"
          className="btn btn--sm btn--quiet"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {open ? 'Esconder o corpo' : 'Escolher no corpo'}
        </button>

        {value && (
          <button
            type="button"
            className="chip chip--on"
            onClick={() => onChange(null)}
            aria-label={`Tirar o filtro ${names.get(value) ?? value}`}
          >
            {names.get(value) ?? value} ✕
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="muscle-filter__bodies">
            <BodyMap
              view="front"
              intensities={intensities}
              label="Frente — toca num músculo para filtrar"
              onPick={pick}
            />
            <BodyMap
              view="back"
              intensities={intensities}
              label="Costas — toca num músculo para filtrar"
              onPick={pick}
            />
          </div>
          <p className="muscle-filter__hint">
            {value
              ? `A mostrar só ${names.get(value) ?? value}. Toca outra vez para tirar.`
              : 'Toca num músculo para ver só os exercícios que o trabalham.'}
          </p>
        </>
      )}
    </div>
  )
}
