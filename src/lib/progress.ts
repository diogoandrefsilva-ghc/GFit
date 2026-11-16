import type { CalendarEntry } from './api'
import { addDays, dayOfMonth, isSameMonth, monthStart, weekStart } from './format'

/**
 * A regularidade do treino, tirada do que já se sabe: as marcações do
 * calendário e os treinos que ficaram acabados. Nada disto se guarda — é
 * conta, feita na altura de mostrar.
 */

/** O que aconteceu (ou está para acontecer) num dia. */
export type DayState = 'done' | 'missed' | 'planned' | 'rest'

export interface DayMark {
  date: string
  state: DayState
  /** As letras dos treinos marcados para o dia ("A", "B"). */
  labels: string[]
}

const isDone = (entry: CalendarEntry) => entry.session?.status === 'done'

/**
 * O estado de cada dia de uma lista de datas. Um dia conta como treinado se
 * houver um treino acabado nele — marcado ou não —, em falta se o que estava
 * marcado ficou por fazer, e por vir se ainda lá não se chegou.
 */
export function dayMarks(
  dates: string[],
  calendar: CalendarEntry[],
  doneDates: string[],
  today: string,
): DayMark[] {
  const trained = new Set(doneDates)
  return dates.map((date) => {
    const entries = calendar.filter((entry) => entry.schedule.scheduled_on === date)
    const labels = entries
      .map((entry) => entry.day?.label)
      .filter((label): label is string => Boolean(label))

    let state: DayState = 'rest'
    if (trained.has(date)) state = 'done'
    else if (entries.length > 0 && entries.every(isDone)) state = 'done'
    else if (entries.some((entry) => !isDone(entry))) {
      state = date < today ? 'missed' : 'planned'
    }
    return { date, state, labels }
  })
}

export interface Streak {
  count: number
  /**
   * Com treinos marcados conta-se treino a treino — quantos seguidos sem
   * falhar um. Sem marcações não há "falhar": contam-se as semanas seguidas
   * em que se treinou.
   */
  unit: 'treinos' | 'semanas'
}

/**
 * Há quanto tempo não se falha. O treino de hoje ainda por fazer não quebra a
 * sequência, e a semana que está a correr também não: só o que já passou.
 */
export function trainingStreak(
  calendar: CalendarEntry[],
  doneDates: string[],
  today: string,
): Streak {
  const past = calendar
    .filter((entry) => entry.schedule.scheduled_on <= today)
    .sort((a, b) => b.schedule.scheduled_on.localeCompare(a.schedule.scheduled_on))

  if (past.length > 0) {
    let count = 0
    for (const entry of past) {
      if (isDone(entry)) count++
      else if (entry.schedule.scheduled_on === today) continue
      else break
    }
    return { count, unit: 'treinos' }
  }

  const weeks = new Set(doneDates.map((date) => weekStart(date)))
  let monday = weekStart(today)
  let count = 0
  if (weeks.has(monday)) count++
  for (;;) {
    monday = addDays(monday, -7)
    if (!weeks.has(monday)) break
    count++
  }
  return { count, unit: 'semanas' }
}

export interface MonthSummary {
  /** Treinos acabados no mês, marcados ou não. */
  done: number
  /** Dos marcados até hoje, quantos por cento ficaram feitos. Nulo sem marcações. */
  adherence: number | null
  scheduled: number
  scheduledDone: number
  /** Treinos por semana, nos dias do mês que já passaram. */
  weeklyAverage: number | null
}

/** O mês em três números. `month` é qualquer dia dele. */
export function monthSummary(
  month: string,
  calendar: CalendarEntry[],
  doneDates: string[],
  today: string,
): MonthSummary {
  const done = doneDates.filter((date) => isSameMonth(date, month)).length

  const due = calendar.filter(
    (entry) =>
      isSameMonth(entry.schedule.scheduled_on, month) &&
      // O de hoje só entra na conta depois de feito: de manhã ainda não é falta.
      (entry.schedule.scheduled_on < today ||
        (entry.schedule.scheduled_on === today && isDone(entry))),
  )
  const scheduledDone = due.filter(isDone).length

  // Quantos dias do mês já contam: todos, num mês passado; até hoje, neste.
  const first = monthStart(month)
  let elapsed = 0
  if (isSameMonth(today, month)) elapsed = dayOfMonth(today)
  else if (first < today) {
    let last = addDays(first, 27)
    while (isSameMonth(addDays(last, 1), month)) last = addDays(last, 1)
    elapsed = dayOfMonth(last)
  }

  return {
    done,
    adherence: due.length > 0 ? Math.round((scheduledDone / due.length) * 100) : null,
    scheduled: due.length,
    scheduledDone,
    weeklyAverage: elapsed > 0 ? done / (elapsed / 7) : null,
  }
}
