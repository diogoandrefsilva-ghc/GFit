/**
 * Os dois sítios onde vive a lista de treinos. O aluno tem-na num separador
 * seu; o treinador tem a sua na área "Eu", onde ele é aluno de si próprio.
 * Os ecrãs de treino são os mesmos nos dois casos — só o caminho de volta
 * muda, e é aqui que muda.
 */
export function workoutsPath(isCoach: boolean): string {
  return isCoach ? '/eu?zona=treino' : '/treino'
}

/**
 * O mesmo para as medidas. O `register` abre logo o formulário de perímetros:
 * é para onde vai o cartão "Registar medidas" do Hoje, e poupa um toque a
 * quem já sabia ao que ia.
 */
export function measurementsPath(isCoach: boolean, register = false): string {
  const base = isCoach ? '/eu?zona=medidas' : '/medidas'
  if (!register) return base
  return `${base}${isCoach ? '&' : '?'}registar=1`
}

/**
 * As vistas da lista de alunos, tal como se escrevem na barra de endereço. A
 * lista abre em "atenção" e é essa que vale quando não se diz nada — os
 * cartões do Início é que apontam a cada uma.
 */
export const ATHLETE_VIEWS = ['atencao', 'todos', 'pausa'] as const

export type AthleteView = (typeof ATHLETE_VIEWS)[number]

export function athletesPath(view: AthleteView): string {
  return `/alunos?ver=${view}`
}

/** As zonas da área pessoal do treinador. */
export const SELF_ZONES = ['hoje', 'treino', 'medidas', 'ficha'] as const

export type SelfZone = (typeof SELF_ZONES)[number]
