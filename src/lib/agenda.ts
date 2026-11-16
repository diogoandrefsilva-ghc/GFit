import { addDays, isoDate, parseIso } from './format'
import type { CalendarEntry } from './api'
import type { Profile, SlotAttendance, TrainingSlot } from './database.types'

/**
 * O treino presencial é uma regra — "sextas às 12h30" — e não uma lista de
 * datas. As sessões de uma semana desenham-se daqui, na altura de as mostrar:
 * não há nada para manter em dia quando o mês vira.
 */

export const WEEKDAY_NAMES = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
]

/** "sextas", "sábados" — o dia como quem diz "treina às…". */
export function weekdayPlural(weekday: number): string {
  return `${WEEKDAY_NAMES[weekday]}s`
}

/** "12:30:00" → "12:30" */
export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

export type PresenceStatus =
  /** Vai — que é o que vale quando o aluno não disse nada. */
  | 'going'
  | 'not_going'
  /** Não vai e propôs outra data, ainda por responder. */
  | 'proposed'
  /** A proposta foi aceite: esta é a sessão na data nova. */
  | 'moved'

/** Uma sessão presencial concreta: a regra posta num dia. */
export interface Presence {
  slot: TrainingSlot
  /** O dia em que acontece. */
  date: string
  /** "12:30" */
  time: string
  /** O dia da regra — diferente de `date` quando a sessão mudou de data. */
  originalDate: string
  attendance: SlotAttendance | null
  status: PresenceStatus
}

function statusOf(attendance: SlotAttendance | null): PresenceStatus {
  if (!attendance || attendance.going) return 'going'
  if (attendance.proposed_date && attendance.proposal_accepted === null) return 'proposed'
  return 'not_going'
}

/** As sessões presenciais entre duas datas, por ordem. */
export function presences(
  slots: TrainingSlot[],
  attendance: SlotAttendance[],
  from: string,
  to: string,
): Presence[] {
  const answers = new Map(
    attendance.map((row) => [`${row.slot_id}|${row.session_date}`, row]),
  )
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const list: Presence[] = []

  for (const slot of slots) {
    const start = slot.starts_on > from ? slot.starts_on : from
    for (let date = start; date <= to; date = addDays(date, 1)) {
      if (parseIso(date).getDay() !== slot.weekday) continue
      const answer = answers.get(`${slot.id}|${date}`) ?? null
      // Uma sessão que mudou de data aparece no dia novo, não neste.
      if (answer && !answer.going && answer.proposed_date && answer.proposal_accepted) continue
      list.push({
        slot,
        date,
        time: hhmm(slot.start_time),
        originalDate: date,
        attendance: answer,
        status: statusOf(answer),
      })
    }
  }

  for (const answer of attendance) {
    if (answer.going || !answer.proposed_date || !answer.proposal_accepted) continue
    if (answer.proposed_date < from || answer.proposed_date > to) continue
    const slot = slotById.get(answer.slot_id)
    if (!slot) continue
    list.push({
      slot,
      date: answer.proposed_date,
      time: hhmm(answer.proposed_time ?? slot.start_time),
      originalDate: answer.session_date,
      attendance: answer,
      status: 'moved',
    })
  }

  return list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

/** A próxima sessão presencial de hoje em diante, olhando três semanas à frente. */
export function nextPresence(
  slots: TrainingSlot[],
  attendance: SlotAttendance[],
  today: string = isoDate(),
): Presence | null {
  return presences(slots, attendance, today, addDays(today, 21))[0] ?? null
}

/** O primeiro dia do mês de uma data: é assim que se chama uma mensalidade. */
export function periodOf(date: string = isoDate()): string {
  return `${date.slice(0, 7)}-01`
}

// ── a agenda do treinador ────────────────────────────────────────────

/**
 * Uma linha da agenda do treinador: um treino do plano marcado numa data, ou
 * uma sessão presencial que sai da regra do aluno.
 */
export type AgendaItem =
  | { kind: 'workout'; key: string; date: string; time: string; entry: CalendarEntry }
  | {
      kind: 'presence'
      key: string
      date: string
      time: string
      presence: Presence
      athlete: Profile | null
    }

/** Junta as duas coisas por ordem: dia, depois hora, e o que não tem hora no fim. */
export function buildAgenda(
  calendar: CalendarEntry[],
  presenceList: Presence[],
  athletes: Profile[],
): AgendaItem[] {
  const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]))
  const items: AgendaItem[] = [
    ...calendar.map(
      (entry): AgendaItem => ({
        kind: 'workout',
        key: entry.schedule.id,
        date: entry.schedule.scheduled_on,
        time: hhmm(entry.schedule.starts_at),
        entry,
      }),
    ),
    ...presenceList.map(
      (presence): AgendaItem => ({
        kind: 'presence',
        key: `${presence.slot.id}|${presence.originalDate}`,
        date: presence.date,
        time: presence.time,
        presence,
        athlete: athleteById.get(presence.slot.athlete_id) ?? null,
      }),
    ),
  ]
  const rank = (item: AgendaItem) => `${item.date} ${item.time || '99:99'}`
  return items.sort((a, b) => rank(a).localeCompare(rank(b)))
}
