import type {
  DietItem,
  Exercise,
  MuscleShare,
  PlanExercise,
  SetLog,
  WeightDirection,
} from './database.types'

export interface Macros {
  protein: number
  fat: number
  carb: number
  kcal: number
}

export const EMPTY_MACROS: Macros = { protein: 0, fat: 0, carb: 0, kcal: 0 }

export function kcalOf(protein: number, fat: number, carb: number): number {
  return protein * 4 + fat * 9 + carb * 4
}

export function macrosOf(items: DietItem[]): Macros {
  const total = items.reduce(
    (acc, item) => ({
      protein: acc.protein + Number(item.protein_g ?? 0),
      fat: acc.fat + Number(item.fat_g ?? 0),
      carb: acc.carb + Number(item.carb_g ?? 0),
    }),
    { protein: 0, fat: 0, carb: 0 },
  )
  return { ...total, kcal: kcalOf(total.protein, total.fat, total.carb) }
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carb: a.carb + b.carb,
    kcal: a.kcal + b.kcal,
  }
}

/** Macros de uma quantidade, a partir dos valores por `base_qty` do alimento. */
export function scaleFood(
  food: { base_qty: number; protein_g: number; fat_g: number; carb_g: number },
  quantity: number,
): { protein_g: number; fat_g: number; carb_g: number } {
  const factor = Number(food.base_qty) > 0 ? quantity / Number(food.base_qty) : 0
  const round = (value: number) => Math.round(Number(value) * factor * 10) / 10
  return {
    protein_g: round(food.protein_g),
    fat_g: round(food.fat_g),
    carb_g: round(food.carb_g),
  }
}

/**
 * Séries semanais por músculo, com os mesmos pesos da planilha: o músculo
 * principal conta a série inteira, os auxiliares contam metade ou 0,3.
 */
export function weeklyVolume(
  planExercises: PlanExercise[],
  exercisesById: Map<string, Exercise>,
): Map<string, number> {
  const volume = new Map<string, number>()

  for (const planExercise of planExercises) {
    if (!planExercise.exercise_id) continue
    const exercise = exercisesById.get(planExercise.exercise_id)
    if (!exercise) continue

    const shares: MuscleShare[] = Array.isArray(exercise.muscles) ? exercise.muscles : []
    for (const share of shares) {
      const current = volume.get(share.muscle) ?? 0
      volume.set(share.muscle, current + planExercise.sets * Number(share.weight ?? 0))
    }
  }
  return volume
}

/** Carga total movida numa sessão (kg × reps), o "tonelagem" do treino. */
export function sessionTonnage(sets: SetLog[]): number {
  return sets.reduce(
    (total, set) => total + Number(set.weight_kg ?? 0) * Number(set.reps ?? 0),
    0,
  )
}

/** Média móvel, para o peso diário não parecer uma serra. */
export function rollingAverage(
  values: (number | null)[],
  window = 7,
): (number | null)[] {
  return values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - window + 1), index + 1)
      .filter((value): value is number => value !== null)
    if (slice.length === 0) return null
    return slice.reduce((sum, value) => sum + value, 0) / slice.length
  })
}

export function average(values: (number | null | undefined)[]): number | null {
  const present = values.filter(
    (value): value is number => value !== null && value !== undefined,
  )
  if (present.length === 0) return null
  return present.reduce((sum, value) => sum + value, 0) / present.length
}

/** Quanto é que o peso tem de mexer para deixar de ser ruído da balança. */
const WEIGHT_NOISE_KG = 0.2

/** Margem que ainda conta como manter o peso. */
const MAINTAIN_BAND_KG = 1

/**
 * Se a variação de peso vai ao encontro do objectivo.
 *
 * Devolve 'good' quando vai, e 'default' quando não vai — nunca um alarme. Uma
 * semana em que o peso andou para o lado errado não é um erro: é uma semana. E
 * sem saber o objectivo não há nada a dizer sobre o número, porque subir é o
 * que se quer em metade dos casos.
 */
export function weightTone(
  change: number | null | undefined,
  direction: WeightDirection | null | undefined,
): 'good' | 'default' {
  if (change === null || change === undefined || !direction) return 'default'

  if (direction === 'maintain') {
    return Math.abs(change) <= MAINTAIN_BAND_KG ? 'good' : 'default'
  }
  if (Math.abs(change) < WEIGHT_NOISE_KG) return 'default'

  return (direction === 'lose' ? change < 0 : change > 0) ? 'good' : 'default'
}

export const WEIGHT_DIRECTION_LABEL: Record<WeightDirection, string> = {
  lose: 'Perder peso',
  gain: 'Ganhar peso',
  maintain: 'Manter o peso',
}

/** Em que semana do plano cai uma data (1-based). */
export function weekOfPlan(startDate: string, on: string): number {
  const start = new Date(startDate).getTime()
  const day = new Date(on).getTime()
  const weeks = Math.floor((day - start) / (7 * 86_400_000))
  return Math.max(1, weeks + 1)
}
