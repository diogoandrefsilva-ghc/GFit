import { ageOn } from './format'
import type {
  AthleteProfile,
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

/**
 * Piso de intensidade: um músculo que foi trabalhado tem sempre de se ver no
 * desenho, mesmo que tenha levado uma série contra as vinte de outro.
 */
const MIN_INTENSITY = 0.2

/**
 * Séries por músculo que se considera uma semana bem servida. Serve de escala
 * ao desenho do corpo: com 20 séries o grupo pinta cheio.
 */
export const WEEKLY_FULL_SETS = 20

/**
 * Volume por músculo → intensidade de 0 a 1 para pintar o corpo.
 *
 * Sem `reference`, a escala é relativa: o músculo mais trabalhado fica cheio e
 * os outros à volta dele. É o que serve para ler um treino. Para uma semana
 * passa-se a referência (as séries que se considera volume cheio), senão um
 * plano leve pintava tão forte como um plano pesado.
 */
export function muscleIntensities(
  volume: Map<string, number>,
  reference?: number,
): Map<string, number> {
  const top =
    reference && reference > 0
      ? reference
      : Math.max(0, ...[...volume.values()].filter((value) => value > 0))
  const intensities = new Map<string, number>()
  if (top <= 0) return intensities

  for (const [slug, sets] of volume) {
    if (sets <= 0) continue
    const share = Math.min(1, sets / top)
    intensities.set(slug, MIN_INTENSITY + (1 - MIN_INTENSITY) * share)
  }
  return intensities
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

/**
 * Os níveis de actividade da folha "Base", com o factor por que se multiplica
 * a taxa metabólica basal para dar o gasto do dia.
 */
export const ACTIVITY_LEVELS: { value: number; label: string; hint: string }[] = [
  { value: 1.2, label: 'Sedentário', hint: 'pouco ou nenhum exercício' },
  { value: 1.375, label: 'Levemente ativo', hint: 'exercício leve 1 a 3 dias por semana' },
  { value: 1.55, label: 'Moderadamente ativo', hint: 'exercício moderado 3 a 5 dias por semana' },
  { value: 1.725, label: 'Altamente ativo', hint: 'exercício pesado 5 a 6 dias por semana' },
  { value: 1.9, label: 'Extremamente ativo', hint: 'exercício pesado todos os dias, até 2 vezes' },
]

/**
 * Taxa metabólica basal pela fórmula de Mifflin-St Jeor, a mesma da folha
 * "Base": 10 × peso + 6,25 × altura − 5 × idade, mais 5 no homem e menos 161
 * na mulher. Sem um dos quatro dados não há número — um palpite aqui ia
 * parar às kcal de alguém.
 */
export function basalMetabolicRate(input: {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  age: number | null | undefined
  sex: 'M' | 'F' | null | undefined
}): number | null {
  const { weightKg, heightCm, age, sex } = input
  if (!weightKg || !heightCm || !age || !sex) return null
  const base = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * age
  return Math.round(base + (sex === 'M' ? 5 : -161))
}

/** O gasto do dia: a basal vezes o nível de actividade. É o "Kcal" da planilha antes do ajuste. */
export function dailyEnergy(bmr: number | null, activity: number | null | undefined): number | null {
  if (!bmr || !activity) return null
  return Math.round(bmr * Number(activity))
}

/** Gramas de um macro a partir da percentagem das kcal (4 kcal/g, ou 9 na gordura). */
export function gramsFromPercent(kcal: number, percent: number, kcalPerGram: number): number {
  return Math.round((kcal * percent) / 100 / kcalPerGram)
}

/** O contrário: que percentagem das kcal é que estas gramas são. */
export function percentFromGrams(kcal: number, grams: number, kcalPerGram: number): number {
  return kcal > 0 ? Math.round(((grams * kcalPerGram) / kcal) * 100) : 0
}

/**
 * A energia de quem está na ficha: a taxa metabólica basal e o gasto do dia,
 * como na folha "Base". O peso é o da ficha; sem ele, o último que o aluno
 * registou.
 */
export function energyOf(
  ficha: AthleteProfile | null,
  lastWeight?: number | null,
): { bmr: number | null; daily: number | null; weight: number | null; missing: string[] } {
  const weight = ficha?.start_weight_kg ?? lastWeight ?? null
  const age = ficha?.birth_date ? ageOn(ficha.birth_date) : null
  const bmr = basalMetabolicRate({
    weightKg: weight,
    heightCm: ficha?.height_cm,
    age,
    sex: ficha?.sex,
  })
  const missing = [
    !weight && 'peso',
    !ficha?.height_cm && 'altura',
    !age && 'data de nascimento',
    !ficha?.sex && 'sexo',
  ].filter((item): item is string => Boolean(item))
  return { bmr, daily: dailyEnergy(bmr, ficha?.activity_level), weight, missing }
}
