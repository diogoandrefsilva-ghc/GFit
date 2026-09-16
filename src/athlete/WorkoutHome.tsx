import { useNavigate } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { fetchActivePlan, fetchWeekSessions, startSession } from '@/lib/api'
import { weekOfPlan } from '@/lib/calc'
import { isoDate, plural, relativeDate } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './workout-home.css'

/** Escolher qual dos treinos do plano fazer, e ver o que já foi feito na semana. */
export function WorkoutHome() {
  const profile = useProfile()
  const navigate = useNavigate()

  const { data, loading, error } = useQuery(async () => {
    const plan = await fetchActivePlan(profile.id)
    if (!plan) return { plan: null, sessions: [], week: 1 }

    const week = weekOfPlan(plan.plan.start_date, isoDate())
    const sessions = await fetchWeekSessions(profile.id, plan.plan.id, week)
    return { plan, sessions, week }
  }, [profile.id])

  if (loading) return <Loading label="A carregar o plano" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { plan, sessions, week } = data!

  if (!plan) {
    return (
      <div className="screen">
        <ScreenHeader title="Treino" />
        <Empty
          title="Ainda sem plano"
          hint="O treinador ainda não publicou nenhum plano para ti."
        />
      </div>
    )
  }

  const byDay = new Map(sessions.map((session) => [session.plan_day_id, session]))
  const doneCount = sessions.filter((session) => session.status === 'done').length

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={`Semana ${week} de ${plan.plan.num_weeks}`}
        title={plan.plan.name}
        subtitle={`${doneCount} de ${plan.days.length} treinos feitos esta semana`}
      />

      <ul className="workout-days">
        {plan.days.map((day) => {
          const exercises = plan.exercisesByDay.get(day.id) ?? []
          const sets = exercises.reduce((sum, item) => sum + item.sets, 0)
          const session = byDay.get(day.id)
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

      {plan.plan.notes && (
        <section className="card card--flat">
          <span className="eyebrow">Notas do plano</span>
          <p className="workout-days__notes">{plan.plan.notes}</p>
        </section>
      )}
    </div>
  )
}
