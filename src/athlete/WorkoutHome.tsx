import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { WeekNav } from '@/components/WeekNav'
import {
  fetchActivePlan,
  fetchAthleteCalendar,
  fetchWeekSessions,
  startSession,
  type CalendarEntry,
} from '@/lib/api'
import { weekOfPlan } from '@/lib/calc'
import {
  dayOfMonth,
  isoDate,
  plural,
  relativeDate,
  weekDates,
  weekStart,
  weekdayShort,
} from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './workout-home.css'

/**
 * A semana de treino: o que o treinador marcou, dia a dia, e o plano inteiro
 * por baixo para quem quiser treinar fora da marcação.
 */
export function WorkoutHome() {
  const profile = useProfile()
  const navigate = useNavigate()
  const today = isoDate()
  const [monday, setMonday] = useState(() => weekStart(today))

  const { data, loading, error } = useQuery(['treino', profile.id, monday, today], async () => {
    const dates = weekDates(monday)
    const [plan, calendar] = await Promise.all([
      fetchActivePlan(profile.id),
      fetchAthleteCalendar(profile.id, dates[0], dates[6]),
    ])
    if (!plan) return { plan: null, calendar, sessions: [], week: 1 }

    const week = weekOfPlan(plan.plan.start_date, today)
    const sessions = await fetchWeekSessions(profile.id, plan.plan.id, week)
    return { plan, calendar, sessions, week }
  })

  async function open(entry: CalendarEntry) {
    if (!entry.plan || !entry.day) return
    const session = await startSession(
      profile.id,
      entry.plan,
      entry.day.id,
      entry.schedule,
    )
    navigate(`/treino/${session.id}`)
  }

  if (loading) return <Loading label="A carregar o plano" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { plan, calendar, sessions, week } = data!
  const dates = weekDates(monday)
  const doneMarks = calendar.filter((entry) => entry.session?.status === 'done').length

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={plan ? `Semana ${week} de ${plan.plan.num_weeks}` : undefined}
        title={plan?.plan.name ?? 'Treino'}
        subtitle={
          calendar.length > 0
            ? `${doneMarks} de ${plural(calendar.length, 'treino marcado', 'treinos marcados')} nesta semana`
            : plan
              ? `${sessions.filter((s) => s.status === 'done').length} de ${plan.days.length} treinos feitos esta semana`
              : undefined
        }
      />

      <WeekNav monday={monday} onChange={setMonday} />

      <ul className="week-days">
        {dates.map((date) => {
          const entries = calendar.filter((entry) => entry.schedule.scheduled_on === date)

          return (
            <li
              key={date}
              className={`week-day ${date === today ? 'is-today' : ''} ${
                entries.length === 0 ? 'is-empty' : ''
              }`}
            >
              <span className="week-day__date">
                <em>{weekdayShort(date)}</em>
                <strong>{dayOfMonth(date)}</strong>
              </span>

              <div className="week-day__body">
                {entries.length === 0 ? (
                  <span className="week-day__rest">descanso</span>
                ) : (
                  entries.map((entry) => (
                    <ScheduledCard
                      key={entry.schedule.id}
                      entry={entry}
                      date={date}
                      today={today}
                      onOpen={() => open(entry)}
                    />
                  ))
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {!plan ? (
        <Empty
          title="Ainda sem plano"
          hint="O treinador ainda não publicou nenhum plano para ti."
        />
      ) : (
        <section className="card card--flat">
          <span className="eyebrow">Todos os treinos do plano</span>
          <p className="subtitle">
            Para treinar fora do que está marcado, escolhe aqui.
          </p>
          <ul className="workout-days">
            {plan.days.map((day) => {
              const exercises = plan.exercisesByDay.get(day.id) ?? []
              const sets = exercises.reduce((sum, item) => sum + item.sets, 0)
              const session = sessions.find((item) => item.plan_day_id === day.id)
              const done = session?.status === 'done'

              return (
                <li key={day.id}>
                  <button
                    type="button"
                    className={`workout-day ${done ? 'is-done' : ''}`}
                    disabled={exercises.length === 0}
                    onClick={async () => {
                      const started = await startSession(profile.id, plan.plan, day.id)
                      navigate(`/treino/${started.id}`)
                    }}
                  >
                    <span className="workout-day__label">{day.label}</span>
                    <span className="workout-day__text">
                      <strong>{day.title ?? `Treino ${day.label}`}</strong>
                      <em>
                        {exercises.length === 0
                          ? 'sem exercícios'
                          : day.mode === 'time'
                            ? `${plural(exercises.length, 'exercício', 'exercícios')} · ${
                                day.flow === 'circuit'
                                  ? `${day.rounds ?? 3} voltas`
                                  : 'por tempo'
                              }`
                            : `${plural(exercises.length, 'exercício', 'exercícios')} · ${plural(sets, 'série', 'séries')}`}
                      </em>
                    </span>
                    <span className="workout-day__state">
                      {done ? (
                        <span className="chip chip--good">
                          feito {session ? relativeDate(session.session_date) : ''}
                        </span>
                      ) : session ? (
                        <span className="chip chip--accent">a meio</span>
                      ) : (
                        <span className="workout-day__go">→</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {plan?.plan.notes && (
        <section className="card card--flat">
          <span className="eyebrow">Notas do plano</span>
          <p className="workout-days__notes">{plan.plan.notes}</p>
        </section>
      )}
    </div>
  )
}

/**
 * Um treino marcado. Só se começa a partir do próprio dia: o calendário diz o
 * que está programado, e adiantar trabalho faz-se pela lista do plano.
 */
function ScheduledCard({
  entry,
  date,
  today,
  onOpen,
}: {
  entry: CalendarEntry
  date: string
  today: string
  onOpen: () => void
}) {
  const done = entry.session?.status === 'done'
  const started = entry.session?.status === 'in_progress'
  const label = entry.day?.label ?? '?'
  const title = entry.day?.title ?? `Treino ${label}`
  const meta =
    entry.exerciseCount === 0
      ? 'sem exercícios'
      : plural(entry.exerciseCount, 'exercício', 'exercícios')

  const body = (
    <>
      <span className={`week-day__tag ${done ? 'is-done' : ''}`}>{label}</span>
      <span className="week-day__text">
        <strong>{title}</strong>
        <em>{meta}</em>
      </span>
      <span className="week-day__state">
        {done ? (
          <span className="chip chip--good">feito</span>
        ) : started ? (
          <span className="chip chip--accent">a meio</span>
        ) : date < today ? (
          <span className="chip">em falta</span>
        ) : date === today ? (
          <span className="workout-day__go">→</span>
        ) : null}
      </span>
    </>
  )

  if (date > today || entry.exerciseCount === 0) {
    return <div className="week-day__card is-locked">{body}</div>
  }

  return (
    <button type="button" className="week-day__card" onClick={onOpen}>
      {body}
    </button>
  )
}
