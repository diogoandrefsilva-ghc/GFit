import { useState } from 'react'
import { scheduleWorkouts, unscheduleWorkout } from '@/lib/api'
import {
  addDays,
  addMonths,
  dayOfMonth,
  daysBetween,
  isSameMonth,
  isoDate,
  monthGrid,
  monthLabel,
  monthStart,
  shortDate,
  weekdayShort,
} from '@/lib/format'
import type { Plan, PlanDay, ScheduledWorkout } from '@/lib/database.types'

/**
 * Marcar o plano no calendário: escolhido o treino lá em cima, toca-se nos dias
 * em que ele se faz. O mesmo treino pode ir a várias datas e a mesma data pode
 * levar mais do que um treino.
 *
 * Só depois de publicado: um rascunho ainda vai mudar, e o aluno não o vê.
 */
export function PlanSchedule({
  plan,
  days,
  activeDay,
  schedules,
  onChanged,
}: {
  plan: Plan
  days: PlanDay[]
  activeDay: PlanDay | null
  schedules: ScheduledWorkout[]
  onChanged: () => void
}) {
  const today = isoDate()
  const [month, setMonth] = useState(() =>
    monthStart(plan.start_date > today ? plan.start_date : today),
  )
  const [busy, setBusy] = useState(false)

  const labelOf = new Map(days.map((day) => [day.id, day.label]))
  const lastDay = addDays(plan.start_date, plan.num_weeks * 7 - 1)

  if (plan.status !== 'published') {
    return (
      <section className="card card--flat">
        <span className="eyebrow">Calendário</span>
        <p className="subtitle">
          O plano ainda é rascunho. Publica-o e depois marca aqui em que dias é
          que cada treino se faz.
        </p>
      </section>
    )
  }

  const marksOn = (date: string) =>
    schedules.filter((row) => row.scheduled_on === date)

  async function toggle(date: string) {
    if (!activeDay || busy) return
    setBusy(true)
    try {
      const existing = schedules.find(
        (row) => row.plan_day_id === activeDay.id && row.scheduled_on === date,
      )
      if (existing) {
        await unscheduleWorkout(existing.id)
      } else {
        await scheduleWorkouts([
          {
            athlete_id: plan.athlete_id,
            coach_id: plan.coach_id,
            plan_id: plan.id,
            plan_day_id: activeDay.id,
            scheduled_on: date,
          },
        ])
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  /** Copia as marcações de uma semana para as semanas seguintes do plano. */
  async function repeatWeek(monday: string) {
    if (busy) return
    const sunday = addDays(monday, 6)
    const week = schedules.filter(
      (row) => row.scheduled_on >= monday && row.scheduled_on <= sunday,
    )
    if (week.length === 0) return

    const rows = []
    for (let next = addDays(monday, 7); next <= lastDay; next = addDays(next, 7)) {
      const shift = daysBetween(monday, next)
      for (const row of week) {
        rows.push({
          athlete_id: plan.athlete_id,
          coach_id: plan.coach_id,
          plan_id: plan.id,
          plan_day_id: row.plan_day_id,
          scheduled_on: addDays(row.scheduled_on, shift),
        })
      }
    }

    setBusy(true)
    try {
      await scheduleWorkouts(rows)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const weeks = monthGrid(month)

  return (
    <section className="card plan-cal">
      <div className="card__head">
        <span className="eyebrow">Calendário</span>
        <span className="muted plan-cal__count">
          {schedules.length === 0
            ? 'sem treinos marcados'
            : `${schedules.length} marcados`}
        </span>
      </div>

      <div className="plan-cal__nav">
        <button
          type="button"
          className="plan-cal__arrow"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <strong className="plan-cal__month">{monthLabel(month)}</strong>
        <button
          type="button"
          className="plan-cal__arrow"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Mês seguinte"
        >
          ›
        </button>
      </div>

      <p className="plan-cal__hint">
        {activeDay
          ? `Toca nos dias em que se faz o treino ${activeDay.label}${
              activeDay.title ? ` · ${activeDay.title}` : ''
            }.`
          : 'Escolhe um treino lá em cima para o marcares.'}
      </p>

      <div className="plan-cal__grid" role="grid">
        {weeks[0].map((date) => (
          <span key={date} className="plan-cal__weekday">
            {weekdayShort(date)}
          </span>
        ))}
        <span className="plan-cal__weekday" />

        {weeks.map((week) => (
          <Week
            key={week[0]}
            week={week}
            month={month}
            today={today}
            planRange={[plan.start_date, lastDay]}
            activeDayId={activeDay?.id ?? null}
            marksOn={marksOn}
            labelOf={labelOf}
            busy={busy}
            onToggle={toggle}
            onRepeat={repeatWeek}
          />
        ))}
      </div>

      <p className="plan-cal__note">
        O ⟳ repete as marcações dessa semana até ao fim do plano —{' '}
        {plan.num_weeks} semanas, até {shortDate(lastDay)}.
      </p>
    </section>
  )
}

function Week({
  week,
  month,
  today,
  planRange,
  activeDayId,
  marksOn,
  labelOf,
  busy,
  onToggle,
  onRepeat,
}: {
  week: string[]
  month: string
  today: string
  planRange: [string, string]
  activeDayId: string | null
  marksOn: (date: string) => ScheduledWorkout[]
  labelOf: Map<string, string>
  busy: boolean
  onToggle: (date: string) => void
  onRepeat: (monday: string) => void
}) {
  const hasMarks = week.some((date) => marksOn(date).length > 0)

  return (
    <>
      {week.map((date) => {
        const marks = marksOn(date)
        const outside = !isSameMonth(date, month)
        const beyond = date < planRange[0] || date > planRange[1]

        return (
          <button
            key={date}
            type="button"
            className={`plan-cal__day ${outside ? 'is-outside' : ''} ${
              beyond ? 'is-beyond' : ''
            } ${date === today ? 'is-today' : ''} ${marks.length ? 'has-marks' : ''}`}
            disabled={busy || !activeDayId}
            onClick={() => onToggle(date)}
          >
            <span className="plan-cal__number">{dayOfMonth(date)}</span>
            <span className="plan-cal__marks">
              {marks.map((mark) => (
                <em
                  key={mark.id}
                  className={mark.plan_day_id === activeDayId ? 'is-active' : ''}
                >
                  {labelOf.get(mark.plan_day_id) ?? '?'}
                </em>
              ))}
            </span>
          </button>
        )
      })}
      <button
        type="button"
        className="plan-cal__repeat"
        disabled={busy || !hasMarks}
        onClick={() => onRepeat(week[0])}
        aria-label={`Repetir a semana de ${dayOfMonth(week[0])} até ao fim do plano`}
        title="Repetir esta semana até ao fim do plano"
      >
        ⟳
      </button>
    </>
  )
}
