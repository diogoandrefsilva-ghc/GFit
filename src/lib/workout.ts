import { repRange, restLabel, titleCase } from './format'
import type { Exercise, PlanDay, PlanExercise, WorkMode } from './database.types'

/** O modo de um exercício: o seu, ou o do treino onde está. */
export function modeOf(day: PlanDay, exercise: PlanExercise): WorkMode {
  return exercise.mode ?? day.mode
}

/** Um treino corre no relógio quando é por tempo do princípio ao fim. */
export function isTimedWorkout(day: PlanDay, exercises: PlanExercise[]): boolean {
  if (exercises.length === 0) return false
  return exercises.every((exercise) => modeOf(day, exercise) === 'time')
}

/** Um passo do treino guiado: ou se trabalha, ou se descansa. */
export interface TimedStep {
  kind: 'work' | 'rest'
  seconds: number
  /** Índice do exercício na lista do dia. */
  exerciseIndex: number
  planExercise: PlanExercise
  exercise: Exercise | null
  /** Série, ou volta do circuito. */
  setNumber: number
  /** Quantas séries/voltas ao todo, para o "3 de 5". */
  totalSets: number
  label: string
}

const DEFAULT_WORK_SECONDS = 45

/**
 * Transforma o plano na sequência que o temporizador vai percorrer.
 *
 * Em 'sets', cada exercício esgota as suas séries antes de se passar ao
 * seguinte. Em 'circuit', percorre-se a lista toda e repete-se a volta, com o
 * descanso maior do treino a separar as voltas.
 *
 * O último descanso é sempre removido: ninguém quer ficar a olhar para um
 * relógio depois de acabar o treino.
 */
export function buildTimeline(
  day: PlanDay,
  planExercises: PlanExercise[],
  library: Map<string, Exercise>,
): TimedStep[] {
  const steps: TimedStep[] = []
  const timed = planExercises.filter((item) => modeOf(day, item) === 'time')
  if (timed.length === 0) return steps

  const exerciseOf = (item: PlanExercise) =>
    item.exercise_id ? library.get(item.exercise_id) ?? null : null

  const nameOf = (item: PlanExercise) =>
    item.name_override ?? exerciseOf(item)?.name ?? 'Exercício'

  const push = (
    kind: 'work' | 'rest',
    seconds: number,
    item: PlanExercise,
    index: number,
    setNumber: number,
    totalSets: number,
    label: string,
  ) => {
    if (seconds <= 0) return
    steps.push({
      kind,
      seconds,
      exerciseIndex: index,
      planExercise: item,
      exercise: exerciseOf(item),
      setNumber,
      totalSets,
      label,
    })
  }

  if (day.flow === 'circuit') {
    const rounds = day.rounds ?? 3
    for (let round = 1; round <= rounds; round++) {
      timed.forEach((item, index) => {
        push(
          'work',
          item.work_seconds ?? DEFAULT_WORK_SECONDS,
          item,
          index,
          round,
          rounds,
          nameOf(item),
        )
        const last = index === timed.length - 1
        // Entre exercícios descansa-se o do exercício; entre voltas, o do treino.
        const rest = last ? day.round_rest_seconds ?? 60 : item.rest_seconds
        if (!(last && round === rounds)) {
          push('rest', rest, item, index, round, rounds, last ? 'Fim da volta' : 'Descanso')
        }
      })
    }
    return steps
  }

  timed.forEach((item, index) => {
    for (let set = 1; set <= item.sets; set++) {
      push(
        'work',
        item.work_seconds ?? DEFAULT_WORK_SECONDS,
        item,
        index,
        set,
        item.sets,
        nameOf(item),
      )
      const lastOfAll = index === timed.length - 1 && set === item.sets
      if (!lastOfAll) {
        push('rest', item.rest_seconds, item, index, set, item.sets, 'Descanso')
      }
    }
  })
  return steps
}

export function timelineDuration(steps: TimedStep[]): number {
  return steps.reduce((total, step) => total + step.seconds, 0)
}

/** "~18 min" — o que se diz antes de começar. */
export function durationLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return 'menos de 1 min'
  if (minutes < 60) return `~${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `~${hours}h` : `~${hours}h ${rest}`
}

/** O que se pede num exercício, numa linha: "3 × 8-12 · RPE 8 · 90s". */
export function prescription(day: PlanDay, item: PlanExercise): string {
  const timed = modeOf(day, item) === 'time'
  const work = timed
    ? `${day.flow === 'circuit' && day.mode === 'time' ? '' : `${item.sets} × `}${restLabel(item.work_seconds ?? 45)}`
    : `${item.sets} × ${repRange(item.rep_min, item.rep_max)}`
  return [
    work,
    item.rpe !== null ? `RPE ${String(Number(item.rpe)).replace('.', ',')}` : null,
    `descanso ${restLabel(item.rest_seconds)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function exerciseName(item: PlanExercise, library: Map<string, Exercise>): string {
  return titleCase(
    item.name_override ??
      (item.exercise_id ? library.get(item.exercise_id)?.name : null) ??
      'Exercício',
  )
}
