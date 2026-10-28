import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth, useProfile } from '@/auth/useAuth'
import { WorkoutList } from '@/athlete/WorkoutList'
import { Loading, ScreenHeader } from '@/components/Screen'
import { fetchPlanById, startSession } from '@/lib/api'
import { isoDate, longDate, plural } from '@/lib/format'
import { workoutsPath } from '@/lib/routes'
import { supabase } from '@/lib/supabase'
import { unwrap, useQuery } from '@/lib/useQuery'
import './workout-session.css'

/**
 * Um treino visto antes de começar: os exercícios, as séries, o que o treinador
 * pediu. Olhar não cria sessão nenhuma — essa só nasce no "Começar treino", e
 * o calendário não dá o treino como "a meio" a quem só foi espreitar.
 *
 * Chega aqui pela lista do plano ou por uma marcação (`?marcacao=`). Uma
 * marcação de um dia que ainda não chegou vê-se mas não se começa: adiantar
 * trabalho faz-se pela lista do plano.
 */
export function WorkoutPreview() {
  const profile = useProfile()
  const { isCoach } = useAuth()
  const navigate = useNavigate()
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>()
  const [params] = useSearchParams()
  const scheduleId = params.get('marcacao')
  const [starting, setStarting] = useState(false)

  const { data, loading, error } = useQuery(['treino-ver', planId, dayId, scheduleId], async () => {
    const [plan, schedules] = await Promise.all([
      fetchPlanById(planId!),
      scheduleId
        ? supabase.from('scheduled_workouts').select('*').eq('id', scheduleId).limit(1)
        : Promise.resolve(null),
    ])
    if (!plan) throw new Error('Plano não encontrado.')
    const schedule = schedules ? unwrap(schedules)[0] ?? null : null
    return { plan, schedule }
  })

  const back = () => navigate(workoutsPath(isCoach))

  if (loading) return <Loading label="A carregar o treino" />
  if (error || !data) {
    return (
      <div className="app">
        <div className="screen screen--plain">
          <p className="error-banner">{error ?? 'Treino não encontrado.'}</p>
          <button type="button" className="btn btn--ghost" onClick={back}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  const { plan, schedule } = data
  const day = plan.days.find((item) => item.id === dayId) ?? null
  const exercises = day ? plan.exercisesByDay.get(day.id) ?? [] : []
  const sets = exercises.reduce((sum, item) => sum + item.sets, 0)
  const today = isoDate()
  const notYet = schedule !== null && schedule.scheduled_on > today

  async function start() {
    if (!day || starting) return
    setStarting(true)
    try {
      const session = await startSession(profile.id, plan.plan, day.id, schedule)
      navigate(`/treino/${session.id}`, { replace: true })
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="app">
      <div className="screen screen--plain session">
        <ScreenHeader
          back={back}
          eyebrow={
            schedule
              ? `Marcado para ${schedule.scheduled_on === today ? 'hoje' : longDate(schedule.scheduled_on).toLowerCase()}`
              : plan.plan.name
          }
          title={day ? `Treino ${day.label}${day.title ? ` · ${day.title}` : ''}` : 'Treino'}
          subtitle={
            day
              ? `${plural(exercises.length, 'exercício', 'exercícios')} · ${
                  day.mode === 'time' && day.flow === 'circuit'
                    ? `${day.rounds ?? 3} voltas`
                    : plural(sets, 'série', 'séries')
                }${day.flow === 'circuit' ? ' · em circuito' : ''}`
              : undefined
          }
        />

        {day?.notes && <p className="session__mode">{day.notes}</p>}

        {day && exercises.length > 0 ? (
          <WorkoutList day={day} exercises={exercises} library={plan.library} />
        ) : (
          <p className="subtitle">Este treino ainda não tem exercícios.</p>
        )}

        {notYet ? (
          <p className="session__mode">
            Começa no próprio dia. Para o fazer antes, escolhe-o na lista do plano.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn--accent btn--block"
            disabled={!day || exercises.length === 0 || starting}
            onClick={start}
          >
            {starting ? 'A começar…' : 'Começar treino'}
          </button>
        )}

        <button type="button" className="btn btn--quiet btn--block" onClick={back}>
          Voltar
        </button>
      </div>
    </div>
  )
}
