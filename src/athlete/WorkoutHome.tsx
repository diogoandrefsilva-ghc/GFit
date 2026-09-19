import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile, useTrainsAlone } from '@/auth/useAuth'
import { MuscleWork } from '@/components/MuscleWork'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { WeekNav } from '@/components/WeekNav'
import {
  createSelfPlan,
  fetchActivePlan,
  fetchAthleteCalendar,
  fetchAthleteProfile,
  fetchMuscles,
  fetchSelfPlans,
  fetchWeekSessions,
  startSession,
  type CalendarEntry,
} from '@/lib/api'
import { WEEKLY_FULL_SETS, weekOfPlan, weeklyVolume } from '@/lib/calc'
import {
  dayOfMonth,
  isoDate,
  plural,
  relativeDate,
  shortDate,
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
  const alone = useTrainsAlone()
  const navigate = useNavigate()
  const today = isoDate()
  const [monday, setMonday] = useState(() => weekStart(today))
  const [creating, setCreating] = useState(false)

  const { data, loading, error } = useQuery(
    ['treino', profile.id, monday, today],
    async () => {
      const dates = weekDates(monday)
      const [plan, calendar, muscles, ficha, selfPlans] = await Promise.all([
        fetchActivePlan(profile.id),
        fetchAthleteCalendar(profile.id, dates[0], dates[6]),
        fetchMuscles(),
        fetchAthleteProfile(profile.id),
        fetchSelfPlans(profile.id),
      ])
      if (!plan) {
        return { plan: null, calendar, sessions: [], week: 1, muscles, ficha, selfPlans }
      }

      const week = weekOfPlan(plan.plan.start_date, today)
      const sessions = await fetchWeekSessions(profile.id, plan.plan.id, week)
      return { plan, calendar, sessions, week, muscles, ficha, selfPlans }
    },
  )

  /** Escrever um treino meu: nasce com os três dias do costume, como os outros. */
  async function newSelfPlan(count: number) {
    if (creating) return
    setCreating(true)
    try {
      const created = await createSelfPlan(profile.id, {
        name: count === 0 ? 'O meu treino' : `O meu treino ${count + 1}`,
        block_name: null,
        num_weeks: 4,
        start_date: isoDate(),
      })
      navigate(`/planos/${created.id}`)
    } finally {
      setCreating(false)
    }
  }

  /**
   * O que a semana trabalha. Se houver treinos marcados, são eles que contam —
   * um treino marcado duas vezes conta duas vezes. Sem marcações, mostra-se o
   * plano inteiro, que é o que a semana daria se fosse cumprida.
   */
  const weekWork = useMemo(() => {
    const plan = data?.plan
    if (!plan) return { volume: new Map<string, number>(), scheduled: false }

    const scheduledDays = (data?.calendar ?? [])
      .filter((entry) => entry.plan?.id === plan.plan.id && entry.day)
      .map((entry) => entry.day!.id)
    const dayIds = scheduledDays.length
      ? scheduledDays
      : plan.days.map((item) => item.id)

    const exercises = dayIds.flatMap((id) => plan.exercisesByDay.get(id) ?? [])
    return {
      volume: weeklyVolume(exercises, plan.library),
      scheduled: scheduledDays.length > 0,
    }
  }, [data?.plan, data?.calendar])

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

  const { plan, calendar, sessions, week, muscles, ficha, selfPlans } = data!
  const muscleNames = new Map(muscles.map((muscle) => [muscle.slug, muscle.name]))
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

      {plan && weekWork.volume.size > 0 && (
        <section className="card card--flat">
          <span className="eyebrow">O que esta semana trabalha</span>
          <p className="subtitle">
            {weekWork.scheduled
              ? 'Somando os treinos marcados para esta semana.'
              : 'Ainda sem treinos marcados — é o que o plano inteiro dá numa semana.'}
          </p>
          <MuscleWork
            volume={weekWork.volume}
            names={muscleNames}
            sex={ficha?.sex}
            reference={WEEKLY_FULL_SETS}
            note={`A cor cheia são ${WEEKLY_FULL_SETS} séries na semana.`}
          />
        </section>
      )}

      {!plan ? (
        <Empty
          title="Ainda sem plano"
          hint={
            alone
              ? 'Ninguém te prescreve treinos — escreve o teu, com os exercícios da base.'
              : 'O treinador ainda não publicou nenhum plano para ti. Entretanto podes escrever o teu.'
          }
          action={
            <button
              type="button"
              className="btn btn--accent"
              disabled={creating}
              onClick={() => newSelfPlan(selfPlans.length)}
            >
              {creating ? 'A criar…' : 'Escrever o meu treino'}
            </button>
          }
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

      {/* Auto-treino: o que a própria pessoa escreveu para si. Fica à parte do
          plano do treinador de propósito — são coisas diferentes, e quem tem as
          duas tem de as distinguir de relance. */}
      {(selfPlans.length > 0 || plan) && (
        <section className="card card--flat">
          <div className="card__head">
            <span className="eyebrow">Escritos por mim</span>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              disabled={creating}
              onClick={() => newSelfPlan(selfPlans.length)}
            >
              {creating ? 'A criar…' : '+ Novo'}
            </button>
          </div>

          {selfPlans.length === 0 ? (
            <p className="subtitle">
              {alone
                ? 'Ainda não escreveste nenhum treino teu.'
                : 'Além do plano do treinador, podes escrever treinos teus. O treinador vê-os.'}
            </p>
          ) : (
            <>
              <p className="subtitle">
                Marca-os no calendário do plano e aparecem na semana, como os
                outros.
              </p>
              <ul className="plan-list">
                {selfPlans.map((item) => (
                  <li key={item.id}>
                    <Link to={`/planos/${item.id}`} className="plan-list__row">
                      <span className="plan-list__name">
                        <strong>{item.name}</strong>
                        <em>
                          {item.num_weeks} semanas · início{' '}
                          {shortDate(item.start_date)}
                        </em>
                      </span>
                      {plan?.plan.id === item.id ? (
                        <span className="chip chip--good">a correr</span>
                      ) : (
                        <span className="chip">editar</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
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
