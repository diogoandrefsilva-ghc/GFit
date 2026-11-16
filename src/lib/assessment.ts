import type { Assessment } from './database.types'

/**
 * As contas de uma avaliação física. Nada disto se guarda na base: sai sempre
 * dos números medidos, para uma correcção ao peso ou a uma prega levar o
 * resultado atrás.
 */

export type Sex = 'M' | 'F'

/** Índice de massa corporal: peso (kg) a dividir pela altura (m) ao quadrado. */
export function bmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || !heightCm) return null
  const metres = Number(heightCm) / 100
  return Number(weightKg) / (metres * metres)
}

export interface Rating {
  label: string
  tone: 'good' | 'default' | 'warn'
}

/** Classificação do IMC pela OMS, para adultos. */
export function bmiClass(value: number | null): Rating | null {
  if (value === null) return null
  if (value < 18.5) return { label: 'Baixo peso', tone: 'warn' }
  if (value < 25) return { label: 'Peso normal', tone: 'good' }
  if (value < 30) return { label: 'Excesso de peso', tone: 'default' }
  if (value < 35) return { label: 'Obesidade grau I', tone: 'warn' }
  if (value < 40) return { label: 'Obesidade grau II', tone: 'warn' }
  return { label: 'Obesidade grau III', tone: 'warn' }
}

type SkinfoldKey =
  | 'sf_chest_mm'
  | 'sf_abdomen_mm'
  | 'sf_thigh_mm'
  | 'sf_triceps_mm'
  | 'sf_suprailiac_mm'

/**
 * As três pregas de Jackson & Pollock: peito, abdómen e coxa no homem;
 * tricípite, supra-ilíaca e coxa na mulher.
 */
export const SKINFOLD_SITES: Record<Sex, { key: SkinfoldKey; label: string }[]> = {
  M: [
    { key: 'sf_chest_mm', label: 'Peito' },
    { key: 'sf_abdomen_mm', label: 'Abdómen' },
    { key: 'sf_thigh_mm', label: 'Coxa' },
  ],
  F: [
    { key: 'sf_triceps_mm', label: 'Tricípite' },
    { key: 'sf_suprailiac_mm', label: 'Supra-ilíaca' },
    { key: 'sf_thigh_mm', label: 'Coxa' },
  ],
}

/**
 * Densidade corporal pela equação das três dobras cutâneas (Jackson & Pollock,
 * 1978 para homens; Jackson, Pollock & Ward, 1980 para mulheres). `sum` é a
 * soma das três pregas em mm.
 */
export function bodyDensity(sex: Sex, sum: number, age: number): number {
  return sex === 'M'
    ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age
}

/** Fórmula de Siri: % de massa gorda a partir da densidade corporal. */
export function siriBodyFat(density: number): number {
  return 495 / density - 450
}

export interface BodyComposition {
  /** Soma das três pregas, em mm. */
  sum: number
  density: number
  fatPercent: number
  fatKg: number | null
  leanKg: number | null
}

/**
 * A composição corporal de uma avaliação. Devolve nulo enquanto faltar uma das
 * três pregas, o sexo ou a idade — meia conta aqui era um número errado com
 * ar de certo.
 */
export function bodyComposition(
  assessment: Partial<Assessment>,
  sex: Sex | null | undefined,
  age: number | null | undefined,
): BodyComposition | null {
  if (!sex || age === null || age === undefined) return null
  const values = SKINFOLD_SITES[sex].map((site) => assessment[site.key])
  if (values.some((value) => value === null || value === undefined)) return null

  const sum = values.reduce<number>((total, value) => total + Number(value), 0)
  if (sum <= 0) return null
  const density = bodyDensity(sex, sum, age)
  const fatPercent = siriBodyFat(density)
  const weight = assessment.weight_kg ? Number(assessment.weight_kg) : null
  const fatKg = weight === null ? null : (weight * fatPercent) / 100

  return {
    sum,
    density,
    fatPercent,
    fatKg,
    leanKg: weight === null || fatKg === null ? null : weight - fatKg,
  }
}

/**
 * Classificação da tensão arterial (ESC/ESH, a que a DGS segue). Manda a
 * categoria mais alta das duas: 150/85 é grau 1 pela sistólica.
 */
export function bloodPressureClass(
  systolic: number | null | undefined,
  diastolic: number | null | undefined,
): Rating | null {
  if (!systolic || !diastolic) return null
  const level = Math.max(
    systolic >= 180 ? 5 : systolic >= 160 ? 4 : systolic >= 140 ? 3 : systolic >= 130 ? 2 : systolic >= 120 ? 1 : 0,
    diastolic >= 110 ? 5 : diastolic >= 100 ? 4 : diastolic >= 90 ? 3 : diastolic >= 85 ? 2 : diastolic >= 80 ? 1 : 0,
  )
  const ratings: Rating[] = [
    { label: 'Ótima', tone: 'good' },
    { label: 'Normal', tone: 'good' },
    { label: 'Normal alta', tone: 'default' },
    { label: 'Hipertensão grau 1', tone: 'warn' },
    { label: 'Hipertensão grau 2', tone: 'warn' },
    { label: 'Hipertensão grau 3', tone: 'warn' },
  ]
  return ratings[level]
}

/**
 * VO2máx estimado pelo Queen's College step test (McArdle, 1972), a partir da
 * frequência cardíaca de recuperação em bpm: 3 minutos a subir e descer um
 * banco de 41,3 cm (24 ciclos/min no homem, 22 na mulher), e o pulso contado
 * durante 15 s, dos 5 aos 20 s depois de parar, vezes quatro.
 */
export function stepTestVo2max(
  sex: Sex | null | undefined,
  recoveryHr: number | null | undefined,
): number | null {
  if (!sex || !recoveryHr) return null
  return sex === 'M' ? 111.33 - 0.42 * recoveryHr : 65.81 - 0.1847 * recoveryHr
}
