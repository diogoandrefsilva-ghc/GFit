import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Loading, ScreenHeader } from '@/components/Screen'
import { Stepper } from '@/components/Stepper'
import { TimedSession } from '@/athlete/TimedSession'
import { VideoModal } from '@/components/VideoModal'
import {
  fetchActivePlan,
  fetchPreviousSets,
  fetchSessionSets,
  finishSession,
  saveSet,
  saveTimedSets,
} from '@/lib/api'
import { hasPlayableVideo } from '@/lib/video'
import { isTimedWorkout } from '@/lib/workout'
import { supabase } from '@/lib/supabase'
import { unwrap, useQuery } from '@/lib/useQuery'
import { clock, num, repRange, restLabel, signed } from '@/lib/format'
import type { PlanExercise, SetLog } from '@/lib/database.types'
import './workout-session.css'

/**
 * O treino a decorrer. Cada série grava carga, repetições e reps em reserva —
 * as colunas C, R e F da planilha — com o que foi feito da última vez à vista.
 */
export function WorkoutSession() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { sessionId } = useParams<{ sessionId: string }>()

  const { data, loading, error } = useQuery(async () => {
    const sessions = unwrap(
      await supabase.from('workout_sessions').select('*').eq('id', sessionId!).limit(1),
    )
    const session = sessions[0]
    if (!session) throw new Error('Treino não encontrado.')

    const plan = await fetchActivePlan(profile.id)
    const day = plan?.days.find((item) => item.id === session.plan_day_id) ?? null
    const exercises = day ? plan!.exercisesByDay.get(day.id) ?? [] : []
    const sets = await fetchSessionSets(session.id)

    return { session, plan, day, exercises, sets }
  }, [sessionId, profile.id])

  const [index, setIndex] = useState(0)
  const [logged, setLogged] = useState<SetLog[]>([])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (data?.sets) setLogged(data.sets)
  }, [data?.sets])

  // Cronómetro a contar desde o início da sessão.
  const startedAt = data?.session.started_at
  useEffect(() => {
    if (!startedAt) return
    const begin = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.round((Date.now() - begin) / 1000))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  if (loading) return <Loading label="A carregar o treino" />
  if (error || !data) {
    return (
      <div className="screen screen--plain">
        <p className="error-banner">{error ?? 'Treino não encontrado.'}</p>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/treino')}>
          Voltar
        </button>
      </div>
    )
  }

  const { session, plan, day, exercises } = data

  // Um treino todo por tempo corre no temporizador guiado; um treino de cargas
  // continua a registar-se série a série. Misturados, manda o registo manual e
  // cada exercício por tempo mostra a sua duração.
  if (day && isTimedWorkout(day, exercises)) {
    return (
      <TimedSession
        day={day}
        planExercises={exercises}
        library={plan?.library ?? new Map()}
        onExit={() => navigate('/treino')}
        onFinish={async (done) => {
          await saveTimedSets(
            session.id,
            done.map((item) => ({
              planExerciseId: item.step.planExercise.id,
              exerciseId: item.step.planExercise.exercise_id,
              setNumber: item.step.setNumber,
              seconds: item.seconds,
            })),
          )
          await finishSession(session.id, session.started_at)
          navigate('/treino')
        }}
      />
    )
  }

  const current = exercises[index]

  if (!current || !day) {
    return (
      <div className="screen screen--plain">
        <ScreenHeader title="Treino sem exercícios" back />
      </div>
    )
  }

  const totalSets = exercises.reduce((sum, item) => sum + item.sets, 0)
  const doneSets = logged.length

  return (
    <div className="app">
      <div className="screen screen--plain session">
        <header className="session__top">
          <button
            type="button"
            className="screen-head__back"
            onClick={() => navigate('/treino')}
            aria-label="Sair do treino"
          >
            ←
          </button>
          <div className="session__top-text">
            <strong>
              Treino {day.label}
              {day.title ? ` · ${day.title}` : ''}
            </strong>
            <span className="muted">
              Exercício {index + 1} de {exercises.length} · {doneSets}/{totalSets} séries
            </span>
          </div>
          <span className="session__clock">{clock(elapsed)}</span>
        </header>

        <ExerciseCard
          key={current.id}
          athleteId={profile.id}
          sessionId={session.id}
          planExercise={current}
          name={
            current.name_override ??
            (current.exercise_id ? plan?.library.get(current.exercise_id)?.name : null) ??
            'Exercício'
          }
          videoUrl={
            current.exercise_id
              ? plan?.library.get(current.exercise_id)?.video_url ?? null
              : null
          }
          muscleLabel={
            current.exercise_id
              ? plan?.library.get(current.exercise_id)?.category ?? null
              : null
          }
          sets={logged.filter((set) => set.plan_exercise_id === current.id)}
          onSaved={(set) =>
            setLogged((previous) => [
              ...previous.filter(
                (item) =>
                  !(
                    item.plan_exercise_id === set.plan_exercise_id &&
                    item.set_number === set.set_number
                  ),
              ),
              set,
            ])
          }
        />

        <nav className="session__nav">
          <button
            type="button"
            className="btn btn--quiet"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            Anterior
          </button>

          {index < exercises.length - 1 ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setIndex(index + 1)}
            >
              Próximo exercício
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--accent"
              onClick={async () => {
                await finishSession(session.id, session.started_at)
                navigate('/treino')
              }}
            >
              Terminar treino
            </button>
          )}
        </nav>

        <ol className="session__dots" aria-label="Exercícios do treino">
          {exercises.map((item, position) => {
            const filled = logged.filter(
              (set) => set.plan_exercise_id === item.id,
            ).length
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`session__dot ${position === index ? 'is-on' : ''} ${
                    filled >= item.sets ? 'is-done' : ''
                  }`}
                  onClick={() => setIndex(position)}
                  aria-label={`Exercício ${position + 1}`}
                />
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

interface CardProps {
  athleteId: string
  sessionId: string
  planExercise: PlanExercise
  name: string
  videoUrl: string | null
  muscleLabel: string | null
  sets: SetLog[]
  onSaved: (set: SetLog) => void
}

function ExerciseCard({
  athleteId,
  sessionId,
  planExercise,
  name,
  videoUrl,
  muscleLabel,
  sets,
  onSaved,
}: CardProps) {
  const [previous, setPrevious] = useState<SetLog[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    let active = true
    fetchPreviousSets(athleteId, planExercise.id, sessionId)
      .then((rows) => active && setPrevious(rows))
      .catch(() => active && setPrevious([]))
    return () => {
      active = false
    }
  }, [athleteId, planExercise.id, sessionId])

  const byNumber = useMemo(
    () => new Map(sets.map((set) => [set.set_number, set])),
    [sets],
  )

  const nextSetNumber = useMemo(() => {
    for (let n = 1; n <= planExercise.sets; n++) {
      if (!byNumber.has(n)) return n
    }
    return planExercise.sets
  }, [byNumber, planExercise.sets])

  // Arranca com a carga da série anterior, ou com a da semana passada.
  const suggestedWeight =
    byNumber.get(nextSetNumber - 1)?.weight_kg ??
    previous?.find((set) => set.set_number === nextSetNumber)?.weight_kg ??
    previous?.[0]?.weight_kg ??
    20

  const suggestedReps =
    previous?.find((set) => set.set_number === nextSetNumber)?.reps ??
    planExercise.rep_max ??
    planExercise.rep_min ??
    10

  const [weight, setWeight] = useState<number | null>(null)
  const [reps, setReps] = useState<number | null>(null)
  const [rir, setRir] = useState<number>(2)

  // Cada série nova volta a propor a carga de referência.
  useEffect(() => {
    setWeight(null)
    setReps(null)
  }, [nextSetNumber])

  const effectiveWeight = weight ?? Number(suggestedWeight)
  const effectiveReps = reps ?? Number(suggestedReps)

  const previousLabel = previous?.length
    ? previous
        .map((set) => `${num(set.weight_kg, 1)} kg × ${set.reps ?? '—'}`)
        .join(', ')
    : null

  const progress =
    previous?.length && previous[0].weight_kg
      ? effectiveWeight - Number(previous[0].weight_kg)
      : null

  const allDone = sets.length >= planExercise.sets

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const saved = await saveSet(
        sessionId,
        planExercise.id,
        planExercise.exercise_id,
        nextSetNumber,
        { weight_kg: effectiveWeight, reps: effectiveReps, rir },
      )
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }, [
    sessionId,
    planExercise.id,
    planExercise.exercise_id,
    nextSetNumber,
    effectiveWeight,
    effectiveReps,
    rir,
    onSaved,
  ])

  return (
    <section className="exercise">
      <div className="exercise__head">
        <h2 className="exercise__name">{name}</h2>
        <p className="exercise__meta">
          {[muscleLabel, `descanso ${restLabel(planExercise.rest_seconds)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {hasPlayableVideo(videoUrl) && (
          <button
            type="button"
            className="exercise__video"
            onClick={() => setShowVideo(true)}
          >
            ▸ Ver demonstração
          </button>
        )}
      </div>

      <table className="sets">
        <thead>
          <tr>
            <th scope="col">Sér</th>
            <th scope="col">Carga</th>
            <th scope="col">Reps</th>
            <th scope="col">Falha</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: planExercise.sets }, (_, position) => {
            const number = position + 1
            const set = byNumber.get(number)
            const active = number === nextSetNumber && !allDone
            return (
              <tr
                key={number}
                className={`${set ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
              >
                <th scope="row">{number}</th>
                <td>{set ? `${num(set.weight_kg, 1)} kg` : '—'}</td>
                <td>{set?.reps ?? '—'}</td>
                <td>{set?.rir !== null && set?.rir !== undefined ? `RIR ${set.rir}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="exercise__target">
        Objetivo: {planExercise.sets} × {repRange(planExercise.rep_min, planExercise.rep_max)} reps
      </p>

      {previousLabel && (
        <div className="exercise__previous">
          <span className="eyebrow">Da última vez</span>
          <p>
            {previousLabel}
            {progress !== null && Math.abs(progress) >= 0.05 && (
              <em className={progress > 0 ? 'is-up' : 'is-down'}>
                {' '}
                {signed(progress, 1)} kg
              </em>
            )}
          </p>
        </div>
      )}

      {planExercise.notes && <p className="exercise__notes">{planExercise.notes}</p>}

      {showVideo && (
        <VideoModal url={videoUrl} title={name} onClose={() => setShowVideo(false)} />
      )}

      {allDone ? (
        <p className="exercise__done">Séries todas registadas ✓</p>
      ) : (
        <div className="exercise__entry">
          <span className="eyebrow">Série {nextSetNumber}</span>

          <div className="exercise__field">
            <span className="field__label">Carga</span>
            <Stepper
              value={effectiveWeight}
              onChange={setWeight}
              step={1.25}
              min={0}
              max={500}
              decimals={2}
              unit="kg"
              size="lg"
              label="carga"
            />
          </div>

          <div className="exercise__field">
            <span className="field__label">Repetições feitas</span>
            <Stepper
              value={effectiveReps}
              onChange={setReps}
              step={1}
              min={0}
              max={60}
              decimals={0}
              label="repetições"
            />
          </div>

          <div className="exercise__field">
            <span className="field__label">Reps em reserva</span>
            <div className="exercise__rir">
              {[0, 1, 2, 3, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`exercise__rir-btn ${rir === value ? 'is-on' : ''}`}
                  onClick={() => setRir(value)}
                  aria-pressed={rir === value}
                >
                  {value === 4 ? '4+' : value}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'A guardar…' : `Guardar série ${nextSetNumber}`}
          </button>
        </div>
      )}
    </section>
  )
}
