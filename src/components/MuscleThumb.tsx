import { useMemo } from 'react'
import { BodyMap } from '@/components/BodyMap'
import { bestView, type BodySex } from '@/lib/body'
import { muscleIntensities } from '@/lib/calc'
import type { MuscleShare } from '@/lib/database.types'
import './body-map.css'

interface Props {
  /** O que o exercício trabalha, como vem da base: slug + peso (1, 0,5 ou 0,3). */
  muscles: MuscleShare[]
  names?: Map<string, string>
  sex?: BodySex
}

/**
 * O corpo em pequeno, para um exercício só. Mostra uma vista — a que apanha
 * mais do que o exercício trabalha — porque abaixo de ~90 px duas vistas lado
 * a lado deixam de se distinguir uma da outra.
 */
export function MuscleThumb({ muscles, names, sex }: Props) {
  const weights = useMemo(
    () =>
      new Map(
        (muscles ?? [])
          .filter((share) => share?.muscle && Number(share.weight) > 0)
          .map((share) => [share.muscle, Number(share.weight)]),
      ),
    [muscles],
  )

  // A referência é 1: o músculo principal pinta cheio, os auxiliares na
  // proporção do peso que a planilha lhes deu.
  const intensities = useMemo(() => muscleIntensities(weights, 1), [weights])

  // Sem músculos atribuídos o corpo fica neutro, mas fica: desaparecer a
  // miniatura desalinhava a coluna do resto da lista.
  const label = weights.size
    ? `Trabalha ${[...weights.keys()].map((slug) => names?.get(slug) ?? slug).join(', ')}`
    : 'Sem músculos atribuídos'

  return (
    <div className="muscle-thumb">
      <BodyMap
        view={bestView(weights)}
        intensities={intensities}
        sex={sex}
        small
        label={label}
      />
    </div>
  )
}
