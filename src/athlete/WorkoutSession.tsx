import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, useProfile } from '@/auth/useAuth'
import { MuscleWork } from '@/components/MuscleWork'
import { Loading, ScreenHeader } from '@/components/Screen'
import { Stepper } from '@/components/Stepper'
import { TimedSession } from '@/athlete/TimedSession'
import { VideoModal } from '@/components/VideoModal'
import { WorkoutList } from '@/athlete/WorkoutList'
import {
  deleteSet,
  fetchActivePlan,
  fetchAthleteProfile,
  fetchMuscles,
  fetchPlanById,
  fetchPreviousSets,
  fetchSessionSets,
  finishSession,
  saveSet,
  saveTimedSets,
} from '@/lib/api'
import { weeklyVolume } from '@/lib/calc'
import { hasPlayableVideo } from '@/lib/video'
import { workoutsPath } from '@/lib/routes'
import { exerciseName, isTimedWorkout } from '@/lib/workout'
import { supabase } from '@/lib/supabase'
import { unwrap, useQuery } from '@/lib/useQuery'
import { clock, num, plural, repRange, restLabel, signed, titleCase } from '@/lib/format'
import type { Exercise, PlanExercise, SetLog } from '@/lib/database.types'
import './workout-session.css'

/** O resumo que fica no ecrã quando o treino acaba. */
interface Summary {
  /** Séries por músculo, contando só o que foi mesmo registado. */
  volume: Map<string, number>
  sets: number
  seconds: number
}

/**
 * O volume do que se fez, e não do que estava escrito: cada exercício conta as
 * séries que ficaram registadas, e daí saem os músculos pelos mesmos pesos da
 * planilha.
 */
function volumeDone(
  exercises: PlanExercise[],
  library: Map<string, Exercise>,
  setsByExercise: Map<string, number>,
): Map<string, number> {
  const done = exercises
    .map((item) => ({ ...item, sets: setsByExercise.get(item.id) ?? 0 }))
    .filter((item) => item.sets > 0)
  return weeklyVolume(done, library)
}

/**
 * O treino a decorrer. Cada série grava carga, repetições e reps em reserva —
 * as colunas C, R e F da planilha — com o que foi feito da última vez à vista.
 */
export function WorkoutSession() {
  const profile = useProfile()
  const { isCoach } = useAuth()
  const navigate = useNavigate()
  const { sessionId } = useParams<{ sessionId: string }>()
  // De onde se veio e para onde se volta: o aluno ao separador Treino, o
  // treinador à lista de treinos da sua área.
  const workouts = workoutsPath(isCoach)

  const { data, loading, error } = useQuery(['treino-sessao', sessionId, profile.id], async () => {
    const sessions = unwrap(
      await supabase.from('workout_sessions').select('*').eq('id', sessionId!).limit(1),
    )
    const session = sessions[0]
    if (!session) throw new Error('Treino não encontrado.')

    // O plano da sessão, e não o mais recente: um treino marcado há semanas
    // pode ser de um plano que entretanto deixou de ser o último.
    const plan = session.plan_id
      ? await fetchPlanById(session.plan_id)
      : await fetchActivePlan(profile.id)
    const day = plan?.days.find((item) => item.id === session.plan_day_id) ?? null
    const exercises = day ? plan!.exercisesByDay.get(day.id) ?? [] : []
    const [sets, muscles, ficha] = await Promise.all([
      fetchSessionSets(session.id),
      fetchMuscles(),
      fetchAthleteProfile(profile.id),
    ])

    return { session, plan, day, exercises, sets, muscles, ficha }
  })

  /** O exercício aberto, ou `null` para o resumo — que é por onde se entra. */
  const [view, setView] = useState<number | null>(null)
  const [logged, setLogged] = useState<SetLog[]>([])
  const [elapsed, setElapsed] = useState(0)
  /** O treino acabado: fica no ecrã em vez de saltar logo para a lista. */
  const [finished, setFinished] = useState<Summary | null>(null)

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
        <button type="button" className="btn btn--ghost" onClick={() => navigate(workouts)}>
          Voltar
        </button>
      </div>
    )
  }

  const { session, plan, day, exercises, muscles, ficha } = data
  const muscleNames = new Map(muscles.map((muscle) => [muscle.slug, muscle.name]))

  if (finished) {
    return (
      <div className="app">
        <div className="screen screen--plain">
          <ScreenHeader
            back={() => navigate(workouts)}
            eyebrow="Treino concluído ✓"
            title={day ? `Treino ${day.label}${day.title ? ` · ${day.title}` : ''}` : 'Treino'}
            subtitle={`${clock(finished.seconds)} · ${plural(finished.sets, 'série registada', 'séries registadas')}`}
          />

          <section className="card card--flat">
            <span className="eyebrow">O que trabalhaste</span>
            {finished.volume.size > 0 ? (
              <MuscleWork
                volume={finished.volume}
                names={muscleNames}
                sex={ficha?.sex}
                note="Séries por músculo, com os auxiliares a contar 0,5 ou 0,3 como na planilha."
              />
            ) : (
              <p className="subtitle">
                Não ficou nenhuma série registada, por isso não há nada a acender.
              </p>
            )}
          </section>

          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={() => navigate(workouts)}
          >
            Voltar aos treinos
          </button>
        </div>
      </div>
    )
  }

  // Um treino todo por tempo corre no temporizador guiado; um treino de cargas
  // continua a registar-se série a série. Misturados, manda o registo manual e
  // cada exercício por tempo mostra a sua duração.
  if (day && isTimedWorkout(day, exercises)) {
    return (
      <TimedSession
        day={day}
        planExercises={exercises}
        library={plan?.library ?? new Map()}
        onExit={() => navigate(workouts)}
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

          const counts = new Map<string, number>()
          for (const item of done) {
            const id = item.step.planExercise.id
            counts.set(id, (counts.get(id) ?? 0) + 1)
          }
          setFinished({
            volume: volumeDone(exercises, plan?.library ?? new Map(), counts),
            sets: done.length,
            seconds: elapsed,
          })
        }}
      />
    )
  }

  if (exercises.length === 0 || !day) {
    return (
      <div className="screen screen--plain">
        <ScreenHeader title="Treino sem exercícios" back />
      </div>
    )
  }

  const library = plan?.library ?? new Map<string, Exercise>()
  const circuit = day.flow === 'circuit'
  const done = countByExercise(logged)
  const totalSets = exercises.reduce((sum, item) => sum + item.sets, 0)
  const doneSets = logged.length
  const upNext = nextExercise(exercises, done, circuit)
  const title = `Treino ${day.label}${day.title ? ` · ${day.title}` : ''}`

  async function finish() {
    const missing = totalSets - doneSets
    if (
      missing > 0 &&
      !window.confirm(
        `Ainda ${missing === 1 ? 'falta 1 série' : `faltam ${missing} séries`}. Terminar o treino assim?`,
      )
    )
      return
    await finishSession(session.id, session.started_at)
    setFinished({
      volume: volumeDone(exercises, library, done),
      sets: logged.length,
      seconds: elapsed,
    })
  }

  // ── o resumo: a lista do treino, com o que já está feito ─────────────
  if (view === null) {
    const round = circuit ? circuitRound(exercises, done) : null
    return (
      <div className="app">
        <div className="screen screen--plain session">
          <header className="session__top">
            <button
              type="button"
              className="screen-head__back"
              onClick={() => navigate(workouts)}
              aria-label="Sair do treino"
            >
              ←
            </button>
            <div className="session__top-text">
              <strong>{title}</strong>
              <span className="muted">
                {doneSets}/{totalSets} séries
                {round ? ` · volta ${round.current} de ${round.total}` : ''}
              </span>
            </div>
            <span className="session__clock">{clock(elapsed)}</span>
          </header>

          {circuit && (
            <p className="session__mode">
              Em circuito: uma série de cada exercício e volta ao primeiro. Ao
              guardar uma série a app passa ao exercício seguinte.
            </p>
          )}

          <WorkoutList
            day={day}
            exercises={exercises}
            library={library}
            done={done}
            current={upNext}
            onOpen={setView}
          />

          {upNext !== null && (
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => setView(upNext)}
            >
              {doneSets === 0 ? 'Começar' : 'Continuar'}:{' '}
              {exerciseName(exercises[upNext], library)}
            </button>
          )}

          {/* Um treino já terminado reabre-se para corrigir uma série; terminá-lo
              outra vez contava a duração desde o início, dias depois. */}
          {session.status === 'done' ? (
            <button
              type="button"
              className="btn btn--quiet btn--block"
              onClick={() => navigate(workouts)}
            >
              Voltar aos treinos
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn--block ${upNext === null ? 'btn--accent' : 'btn--quiet'}`}
              onClick={finish}
            >
              Terminar treino
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── um exercício ─────────────────────────────────────────────────────
  const index = Math.min(view, exercises.length - 1)
  const current = exercises[index]

  return (
    <div className="app">
      <div className="screen screen--plain session">
        <header className="session__top">
          <button
            type="button"
            className="screen-head__back"
            onClick={() => setView(null)}
            aria-label="Voltar ao resumo do treino"
          >
            ←
          </button>
          <div className="session__top-text">
            <strong>{title}</strong>
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
          name={exerciseName(current, library)}
          videoUrl={
            current.exercise_id ? library.get(current.exercise_id)?.video_url ?? null : null
          }
          muscleLabel={
            current.exercise_id
              ? titleCase(library.get(current.exercise_id)?.category) || null
              : null
          }
          round={circuit ? circuitRound(exercises, done)?.current ?? null : null}
          sets={logged.filter((set) => set.plan_exercise_id === current.id)}
          onSaved={(set, isNew) => {
            const next = [
              ...logged.filter(
                (item) =>
                  !(
                    item.plan_exercise_id === set.plan_exercise_id &&
                    item.set_number === set.set_number
                  ),
              ),
              set,
            ]
            setLogged(next)
            // Em circuito, guardar uma série é passar ao exercício seguinte
            // da volta; acabadas as voltas, volta-se ao resumo.
            if (circuit && isNew) {
              const following = nextInCircuit(exercises, countByExercise(next), index, set.set_number)
              setView(following)
            }
          }}
          onDeleted={(set) =>
            setLogged((previous) => previous.filter((item) => item.id !== set.id))
          }
        />

        <nav className="session__nav">
          <button
            type="button"
            className="btn btn--quiet"
            disabled={index === 0}
            onClick={() => setView(index - 1)}
          >
            Anterior
          </button>

          {index < exercises.length - 1 ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setView(index + 1)}
            >
              Próximo exercício
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => setView(null)}>
              Resumo do treino
            </button>
          )}
        </nav>

        <button type="button" className="session__summary" onClick={() => setView(null)}>
          ☰ Ver o resumo do treino
        </button>

        <ol className="session__dots" aria-label="Exercícios do treino">
          {exercises.map((item, position) => (
            <li key={item.id}>
              <button
                type="button"
                className={`session__dot ${position === index ? 'is-on' : ''} ${
                  (done.get(item.id) ?? 0) >= item.sets ? 'is-done' : ''
                }`}
                onClick={() => setView(position)}
                aria-label={`Exercício ${position + 1}`}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** Séries registadas por exercício do plano. */
function countByExercise(sets: SetLog[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const set of sets) {
    if (!set.plan_exercise_id) continue
    counts.set(set.plan_exercise_id, (counts.get(set.plan_exercise_id) ?? 0) + 1)
  }
  return counts
}

/**
 * O exercício que vem a seguir. Série a série, é o primeiro por acabar. Em
 * circuito, é o que vai mais atrasado — que é como se dá a volta.
 */
function nextExercise(
  exercises: PlanExercise[],
  done: Map<string, number>,
  circuit: boolean,
): number | null {
  let best: number | null = null
  exercises.forEach((item, index) => {
    const count = done.get(item.id) ?? 0
    if (count >= item.sets) return
    if (best === null) best = index
    else if (circuit && count < (done.get(exercises[best].id) ?? 0)) best = index
  })
  return best
}

/** Em que volta vai o circuito: a do exercício mais atrasado, de quantas. */
function circuitRound(
  exercises: PlanExercise[],
  done: Map<string, number>,
): { current: number; total: number } | null {
  const total = Math.max(0, ...exercises.map((item) => item.sets))
  const pending = exercises.filter((item) => (done.get(item.id) ?? 0) < item.sets)
  if (pending.length === 0 || total === 0) return null
  const current = Math.min(...pending.map((item) => done.get(item.id) ?? 0)) + 1
  return { current, total }
}

/**
 * Depois de guardar a série `round` do exercício `from`: o seguinte da lista
 * que ainda não fez esta volta; se já todos a fizeram, o primeiro da volta
 * seguinte; e o resumo (`null`) quando não há mais nada.
 */
function nextInCircuit(
  exercises: PlanExercise[],
  done: Map<string, number>,
  from: number,
  round: number,
): number | null {
  for (let step = 1; step <= exercises.length; step++) {
    const index = (from + step) % exercises.length
    const item = exercises[index]
    const count = done.get(item.id) ?? 0
    if (count < round && count < item.sets) return index
  }
  return nextExercise(exercises, done, true)
}

interface CardProps {
  athleteId: string
  sessionId: string
  planExercise: PlanExercise
  name: string
  videoUrl: string | null
  muscleLabel: string | null
  /** Em circuito, a volta em que se vai. */
  round: number | null
  sets: SetLog[]
  /** `isNew` diz se a série é nova ou se foi uma correcção. */
  onSaved: (set: SetLog, isNew: boolean) => void
  onDeleted: (set: SetLog) => void
}

/** "60 kg", ou "22,5 kg" quando vem de antes de a carga ser só inteiros. */
function kg(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const number = Number(value)
  return `${num(number, Number.isInteger(number) ? 0 : 1)} kg`
}

function ExerciseCard({
  athleteId,
  sessionId,
  planExercise,
  name,
  videoUrl,
  muscleLabel,
  round,
  sets,
  onSaved,
  onDeleted,
}: CardProps) {
  const [previous, setPrevious] = useState<SetLog[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  /** A série já guardada que se está a corrigir, se houver. */
  const [editing, setEditing] = useState<number | null>(null)

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

  const target = editing ?? nextSetNumber
  const editingSet = editing !== null ? byNumber.get(editing) ?? null : null

  // Arranca com a carga da série anterior, ou com a da semana passada. A carga
  // anda de quilo em quilo: o que vier com casas de antes arredonda-se.
  const suggestedWeight = Math.round(
    Number(
      byNumber.get(target - 1)?.weight_kg ??
        previous?.find((set) => set.set_number === target)?.weight_kg ??
        previous?.[0]?.weight_kg ??
        20,
    ),
  )

  const suggestedReps =
    previous?.find((set) => set.set_number === target)?.reps ??
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

  const effectiveWeight = weight ?? suggestedWeight
  const effectiveReps = reps ?? Number(suggestedReps)

  const previousLabel = previous?.length
    ? previous.map((set) => `${kg(set.weight_kg)} × ${set.reps ?? '—'}`).join(', ')
    : null

  const progress =
    previous?.length && previous[0].weight_kg
      ? effectiveWeight - Number(previous[0].weight_kg)
      : null

  const allDone = sets.length >= planExercise.sets

  function startEditing(set: SetLog) {
    setEditing(set.set_number)
    setWeight(set.weight_kg !== null ? Number(set.weight_kg) : null)
    setReps(set.reps)
    if (set.rir !== null) setRir(set.rir)
  }

  function stopEditing() {
    setEditing(null)
    setWeight(null)
    setReps(null)
  }

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const saved = await saveSet(
        sessionId,
        planExercise.id,
        planExercise.exercise_id,
        target,
        { weight_kg: effectiveWeight, reps: effectiveReps, rir },
      )
      const isNew = editing === null
      setEditing(null)
      setWeight(null)
      setReps(null)
      onSaved(saved, isNew)
    } finally {
      setSaving(false)
    }
  }, [
    sessionId,
    planExercise.id,
    planExercise.exercise_id,
    target,
    editing,
    effectiveWeight,
    effectiveReps,
    rir,
    onSaved,
  ])

  async function remove(set: SetLog) {
    if (!window.confirm(`Apagar a série ${set.set_number}?`)) return
    setSaving(true)
    try {
      await deleteSet(set.id)
      stopEditing()
      onDeleted(set)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="exercise">
      <div className="exercise__head">
        {round !== null && <span className="eyebrow">Circuito · volta {round}</span>}
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
            <th scope="col" aria-label="Corrigir" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: planExercise.sets }, (_, position) => {
            const number = position + 1
            const set = byNumber.get(number)
            const active = editing !== null ? number === editing : number === nextSetNumber && !allDone
            return (
              <tr
                key={number}
                className={`${set ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
                onClick={set && editing !== number ? () => startEditing(set) : undefined}
              >
                <th scope="row">{number}</th>
                <td>{set ? kg(set.weight_kg) : '—'}</td>
                <td>{set?.reps ?? '—'}</td>
                <td>{set?.rir !== null && set?.rir !== undefined ? `RIR ${set.rir}` : '—'}</td>
                <td className="sets__edit">
                  {set && editing !== number && (
                    <button
                      type="button"
                      className="sets__edit-btn"
                      aria-label={`Corrigir a série ${number}`}
                    >
                      ✎
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="exercise__target">
        Objetivo: {planExercise.sets} × {repRange(planExercise.rep_min, planExercise.rep_max)} reps
        {planExercise.rpe !== null && ` · RPE ${num(Number(planExercise.rpe), Number.isInteger(Number(planExercise.rpe)) ? 0 : 1)}`}
      </p>

      {previousLabel && (
        <div className="exercise__previous">
          <span className="eyebrow">Da última vez</span>
          <p>
            {previousLabel}
            {progress !== null && Math.abs(progress) >= 0.05 && (
              <em className={progress > 0 ? 'is-up' : 'is-down'}>
                {' '}
                {signed(progress, Number.isInteger(progress) ? 0 : 1)} kg
              </em>
            )}
          </p>
        </div>
      )}

      {planExercise.notes && <p className="exercise__notes">{planExercise.notes}</p>}

      {showVideo && (
        <VideoModal url={videoUrl} title={name} onClose={() => setShowVideo(false)} />
      )}

      {allDone && editing === null ? (
        <p className="exercise__done">
          Séries todas registadas ✓
          <span>Toca numa série para a corrigir ou apagar.</span>
        </p>
      ) : (
        <div className={`exercise__entry ${editing !== null ? 'is-editing' : ''}`}>
          <span className="eyebrow">
            {editing !== null ? `A corrigir a série ${editing}` : `Série ${target}`}
          </span>

          <div className="exercise__field">
            <span className="field__label">Carga</span>
            <Stepper
              value={effectiveWeight}
              onChange={setWeight}
              step={1}
              min={0}
              max={500}
              decimals={0}
              unit="kg"
              size="lg"
              label="carga"
              typeable
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
              typeable
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
            {saving
              ? 'A guardar…'
              : editing !== null
                ? `Guardar a série ${editing}`
                : `Guardar série ${target}`}
          </button>

          {editingSet && (
            <div className="row">
              <button type="button" className="btn btn--quiet" onClick={stopEditing}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--danger"
                disabled={saving}
                onClick={() => remove(editingSet)}
              >
                Apagar série
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
