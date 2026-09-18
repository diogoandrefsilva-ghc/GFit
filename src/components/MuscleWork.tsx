import { useMemo, useState } from 'react'
import { BodyMap, type BodySex } from '@/components/BodyMap'
import { muscleIntensities } from '@/lib/calc'
import { num } from '@/lib/format'
import './body-map.css'

interface Props {
  /** Slug → séries (ou o que se estiver a contar) por músculo. */
  volume: Map<string, number>
  /** Slug → nome a mostrar, vindo da tabela `muscles`. */
  names: Map<string, string>
  sex?: BodySex
  /**
   * Quantas séries valem a intensidade máxima. Sem valor, a escala é relativa
   * ao músculo mais trabalhado — o que serve para ler um treino. Para uma
   * semana convém fixar um número, senão 3 séries parecem muito.
   */
  reference?: number
  /** O que está a ser contado, para a legenda. */
  unit?: string
  note?: string
}

/**
 * O corpo com o volume de treino por cima: as duas vistas e a legenda com os
 * números que as pintaram. Toca-se num músculo — no desenho ou na legenda —
 * para o ler à parte.
 */
export function MuscleWork({
  volume,
  names,
  sex,
  reference,
  unit = 'séries',
  note,
}: Props) {
  const [picked, setPicked] = useState<string | null>(null)

  const intensities = useMemo(
    () => muscleIntensities(volume, reference),
    [volume, reference],
  )

  const worked = useMemo(
    () => [...volume.entries()].filter(([, sets]) => sets > 0).sort((a, b) => b[1] - a[1]),
    [volume],
  )

  const label = worked.length
    ? `Trabalhado: ${worked.map(([slug]) => names.get(slug) ?? slug).join(', ')}`
    : 'Nenhum músculo trabalhado'

  const toggle = (slug: string) =>
    setPicked((current) => (current === slug ? null : slug))

  const sets = (value: number) => num(value, value % 1 === 0 ? 0 : 1)

  return (
    <div className="muscle-work">
      <div className="muscle-work__bodies">
        <BodyMap
          view="front"
          intensities={intensities}
          sex={sex}
          label={label}
          onPick={toggle}
        />
        <BodyMap
          view="back"
          intensities={intensities}
          sex={sex}
          label={label}
          onPick={toggle}
        />
      </div>

      {worked.length > 0 && (
        <ul className="muscle-work__legend">
          {worked.map(([slug, value]) => (
            <li key={slug}>
              <button
                type="button"
                className={picked === slug ? 'is-picked' : ''}
                onClick={() => toggle(slug)}
              >
                <i style={{ opacity: intensities.get(slug) ?? 0 }} />
                <span>{names.get(slug) ?? slug}</span>
                <em>{sets(value)}</em>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <p className="muscle-work__note">
          <strong>{names.get(picked) ?? picked}</strong> ·{' '}
          {sets(volume.get(picked) ?? 0)} {unit}
        </p>
      )}

      {note && !picked && <p className="muscle-work__note">{note}</p>}
    </div>
  )
}
