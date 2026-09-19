/**
 * Os dois sítios onde vive a lista de treinos. O aluno tem-na num separador
 * seu; o treinador tem a sua na área "Eu", onde ele é aluno de si próprio.
 * Os ecrãs de treino são os mesmos nos dois casos — só o caminho de volta
 * muda, e é aqui que muda.
 */
export function workoutsPath(isCoach: boolean): string {
  return isCoach ? '/eu?zona=treino' : '/treino'
}

/** As zonas da área pessoal do treinador. */
export const SELF_ZONES = ['hoje', 'treino', 'medidas', 'ficha'] as const

export type SelfZone = (typeof SELF_ZONES)[number]
