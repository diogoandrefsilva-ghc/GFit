import { useState } from 'react'
import { Stat } from '@/components/Screen'
import { fetchAthleteCalendar, fetchDoneDates } from '@/lib/api'
import {
  addMonths,
  dayOfMonth,
  isSameMonth,
  isoDate,
  monthGrid,
  monthLabel,
  monthStart,
  num,
  plural,
  weekdayShort,
} from '@/lib/format'
import { dayMarks, monthSummary, type DayMark, type Streak } from '@/lib/progress'
import { useQuery } from '@/lib/useQuery'
import './regularity.css'

const STATE_LABEL: Record<DayMark['state'], string> = {
  done: 'treinado',
  missed: 'treino em falta',
  planned: 'treino marcado',
  rest: 'sem treino',
}

/**
 * A semana num relance, no Hoje: os sete dias, os que já foram treinados, o
 * que está marcado e o que ficou por fazer — e há quanto tempo não se falha.
 * É a razão para voltar a abrir a app amanhã.
 */
export function WeekStreak({
  marks,
  streak,
  today,
}: {
  marks: DayMark[]
  streak: Streak
  today: string
}) {
  const done = marks.filter((mark) => mark.state === 'done').length
  const due = marks.filter((mark) => mark.state !== 'rest').length

  const headline =
    streak.count >= 2
      ? streak.unit === 'treinos'
        ? `${streak.count} treinos seguidos`
        : `${streak.count} semanas seguidas`
      : due > 0
        ? `${done} de ${plural(due, 'treino', 'treinos')}`
        : plural(done, 'treino', 'treinos')

  return (
    <section className="card streak">
      <div className="card__head">
        <span className="eyebrow">A tua semana</span>
        <strong className={`streak__count ${streak.count >= 2 ? 'is-hot' : ''}`}>
          {headline}
        </strong>
      </div>

      <ol className="streak__days">
        {marks.map((mark) => (
          <li
            key={mark.date}
            className={`streak__day is-${mark.state} ${mark.date === today ? 'is-today' : ''}`}
            aria-label={`${weekdayShort(mark.date)} ${dayOfMonth(mark.date)}: ${STATE_LABEL[mark.state]}`}
          >
            <em aria-hidden>{weekdayShort(mark.date).charAt(0).toUpperCase()}</em>
            <span className="streak__dot" aria-hidden>
              {mark.state === 'done' ? '✓' : dayOfMonth(mark.date)}
            </span>
            <i aria-hidden>{mark.labels.join(' ')}</i>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * O mês de treino: quantos se fizeram, quanto do que estava marcado ficou
 * cumprido, e o calendário com os dias treinados. Tem a sua própria leitura
 * porque anda para trás, mês a mês, sem mexer no resto do ecrã.
 */
export function MonthSummaryCard({ athleteId }: { athleteId: string }) {
  const today = isoDate()
  const [month, setMonth] = useState(() => monthStart(today))
  const isCurrent = isSameMonth(month, today)

  const weeks = monthGrid(month)
  const from = weeks[0][0]
  const to = weeks[weeks.length - 1][6]

  const { data } = useQuery(['mes-treino', athleteId, month, today], async () => {
    const [calendar, doneDates] = await Promise.all([
      fetchAthleteCalendar(athleteId, from, to),
      fetchDoneDates(athleteId, from, to),
    ])
    return { calendar, doneDates }
  })

  const calendar = data?.calendar ?? []
  const doneDates = data?.doneDates ?? []
  const summary = monthSummary(month, calendar, doneDates, today)

  return (
    <section className="card month">
      <div className="card__head">
        <span className="eyebrow">O teu mês</span>
        <div className="month__nav">
          <button
            type="button"
            className="month__step"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <strong className="month__label">{monthLabel(month)}</strong>
          <button
            type="button"
            className="month__step"
            disabled={isCurrent}
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Mês seguinte"
          >
            ›
          </button>
        </div>
      </div>

      <div className="row">
        <Stat label="Treinos feitos" value={data ? summary.done : '—'} />
        <Stat
          label="Adesão"
          value={summary.adherence !== null ? `${summary.adherence}%` : '—'}
          hint={
            summary.adherence !== null
              ? `${summary.scheduledDone} de ${summary.scheduled} marcados`
              : 'sem treinos marcados'
          }
          tone={summary.adherence !== null && summary.adherence >= 90 ? 'good' : 'default'}
        />
        <Stat
          label="Por semana"
          value={
            data && summary.weeklyAverage !== null ? num(summary.weeklyAverage, 1) : '—'
          }
          hint="em média"
        />
      </div>

      <div className="month__grid" role="img" aria-label={`Dias treinados em ${monthLabel(month)}`}>
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((letter, index) => (
          <em key={index} className="month__weekday">
            {letter}
          </em>
        ))}
        {weeks.flatMap((week) =>
          dayMarks(week, calendar, doneDates, today).map((mark) => (
            <span
              key={mark.date}
              className={`month__day is-${mark.state} ${
                isSameMonth(mark.date, month) ? '' : 'is-outside'
              } ${mark.date === today ? 'is-today' : ''}`}
            >
              {dayOfMonth(mark.date)}
            </span>
          )),
        )}
      </div>

      <p className="month__legend muted">
        <span className="month__key is-done" /> treinado
        <span className="month__key is-missed" /> em falta
        <span className="month__key is-planned" /> marcado
      </p>
    </section>
  )
}
