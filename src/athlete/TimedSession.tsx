import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VideoModal } from '@/components/VideoModal'
import { cueFinish, cueRest, cueStart, cueTick, primeAudio } from '@/lib/cues'
import { useWakeLock } from '@/lib/useWakeLock'
import { buildTimeline, durationLabel, timelineDuration, type TimedStep } from '@/lib/workout'
import { clock, titleCase } from '@/lib/format'
import { hasPlayableVideo } from '@/lib/video'
import type { Exercise, PlanDay, PlanExercise } from '@/lib/database.types'
import './timed-session.css'

interface Props {
  day: PlanDay
  planExercises: PlanExercise[]
  library: Map<string, Exercise>
  onFinish: (done: { step: TimedStep; seconds: number }[]) => Promise<void>
  onExit: () => void
}

/**
 * O treino a correr no relógio. A app conduz: conta o trabalho, conta o
 * descanso, avisa nas transições e passa sozinha ao passo seguinte. O aluno só
 * precisa de olhar quando quer saber quanto falta.
 */
export function TimedSession({ day, planExercises, library, onFinish, onExit }: Props) {
  const steps = useMemo(
    () => buildTimeline(day, planExercises, library),
    [day, planExercises, library],
  )

  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(steps[0]?.seconds ?? 0)
  const [paused, setPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const [video, setVideo] = useState<TimedStep | null>(null)
  const [saving, setSaving] = useState(false)

  // O que foi feito, para gravar no fim.
  const done = useRef<{ step: TimedStep; seconds: number }[]>([])

  useWakeLock(started && !paused && !finished)

  const step = steps[index] ?? null
  const next = steps[index + 1] ?? null

  const advance = useCallback(() => {
    const current = steps[index]
    if (current?.kind === 'work') {
      done.current.push({ step: current, seconds: current.seconds })
    }

    const following = index + 1
    if (following >= steps.length) {
      cueFinish()
      setFinished(true)
      return
    }

    setIndex(following)
    setRemaining(steps[following].seconds)
    if (steps[following].kind === 'work') cueStart()
    else cueRest()
  }, [index, steps])

  // O relógio. Conta para trás uma vez por segundo e avisa nos últimos três.
  useEffect(() => {
    if (!started || paused || finished || !step) return

    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) return 0
        if (value <= 4) cueTick()
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [started, paused, finished, step])

  // Chegou a zero: passo seguinte.
  useEffect(() => {
    if (started && !paused && !finished && remaining === 0 && step) advance()
  }, [remaining, started, paused, finished, step, advance])

  const totalSeconds = useMemo(() => timelineDuration(steps), [steps])
  const elapsedBefore = useMemo(
    () => steps.slice(0, index).reduce((sum, item) => sum + item.seconds, 0),
    [steps, index],
  )
  const progress = totalSeconds
    ? Math.min(100, ((elapsedBefore + (step ? step.seconds - remaining : 0)) / totalSeconds) * 100)
    : 0

  if (steps.length === 0) {
    return (
      <div className="timed timed--empty">
        <p className="subtitle">Este treino ainda não tem exercícios por tempo.</p>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Voltar
        </button>
      </div>
    )
  }

  // ── antes de começar ──────────────────────────────────────────────
  if (!started) {
    const workSteps = steps.filter((item) => item.kind === 'work')
    return (
      <div className="timed timed--intro">
        <span className="eyebrow">
          {day.flow === 'circuit'
            ? `Circuito · ${day.rounds ?? 3} voltas`
            : 'Séries cronometradas'}
        </span>
        <h1 className="title">
          Treino {day.label}
          {day.title ? ` · ${day.title}` : ''}
        </h1>
        <p className="subtitle">
          {workSteps.length} blocos de trabalho · {durationLabel(totalSeconds)}
        </p>

        <ol className="timed__preview">
          {planExercises.map((item, position) => {
            const exercise = item.exercise_id ? library.get(item.exercise_id) : null
            return (
              <li key={item.id}>
                <span className="timed__preview-n">{position + 1}</span>
                <span className="timed__preview-text">
                  <strong>{titleCase(item.name_override ?? exercise?.name ?? 'Exercício')}</strong>
                  <em>
                    {item.work_seconds ?? 45}s
                    {day.flow === 'circuit' ? '' : ` × ${item.sets}`} · descanso{' '}
                    {item.rest_seconds}s
                  </em>
                </span>
              </li>
            )
          })}
        </ol>

        <div className="timed__intro-actions">
          <button type="button" className="btn btn--quiet" onClick={onExit}>
            Voltar
          </button>
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => {
              primeAudio()
              cueStart()
              setStarted(true)
            }}
          >
            Começar
          </button>
        </div>

        <p className="timed__hint muted">
          O ecrã fica aceso e a app avisa em cada mudança.
        </p>
      </div>
    )
  }

  // ── terminado ─────────────────────────────────────────────────────
  if (finished) {
    const workDone = done.current.length
    const seconds = done.current.reduce((sum, item) => sum + item.seconds, 0)
    return (
      <div className="timed timed--done">
        <span className="timed__done-mark">✓</span>
        <h1 className="title">Treino feito</h1>
        <p className="subtitle">
          {workDone} blocos · {clock(seconds)} de trabalho
        </p>
        <button
          type="button"
          className="btn btn--accent btn--block"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onFinish(done.current)
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'A guardar…' : 'Guardar treino'}
        </button>
      </div>
    )
  }

  // ── a decorrer ────────────────────────────────────────────────────
  const working = step!.kind === 'work'

  return (
    <div className={`timed ${working ? 'is-work' : 'is-rest'}`}>
      <div className="timed__bar" style={{ width: `${progress}%` }} />

      <header className="timed__top">
        <button type="button" className="timed__exit" onClick={onExit} aria-label="Sair">
          ✕
        </button>
        <span className="timed__where">
          {day.flow === 'circuit'
            ? `Volta ${step!.setNumber} de ${step!.totalSets}`
            : `Série ${step!.setNumber} de ${step!.totalSets}`}
          {' · '}
          {step!.exerciseIndex + 1}/{planExercises.length}
        </span>
      </header>

      <div className="timed__stage">
        <span className="timed__kind">{working ? 'Trabalho' : 'Descanso'}</span>
        {/* No trabalho o título é o exercício; no descanso é o próprio
            descanso, e o que vem a seguir fica na linha de baixo. */}
        <h1 className="timed__name">{step!.label}</h1>

        <div className={`timed__clock ${remaining <= 4 ? 'is-close' : ''}`}>
          {remaining}
        </div>

        {!working && next && (
          <p className="timed__next">
            a seguir: <strong>{next.label}</strong>
          </p>
        )}

        {working && hasPlayableVideo(step!.exercise?.video_url) && (
          <button
            type="button"
            className="timed__video"
            onClick={() => setVideo(step)}
          >
            ▸ Ver como se faz
          </button>
        )}

        {working && step!.planExercise.notes && (
          <p className="timed__notes">{step!.planExercise.notes}</p>
        )}
      </div>

      <div className="timed__controls">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => setRemaining((value) => value + 15)}
        >
          +15s
        </button>
        <button
          type="button"
          className="btn btn--primary timed__pause"
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'Continuar' : 'Pausa'}
        </button>
        <button type="button" className="btn btn--quiet" onClick={advance}>
          Saltar
        </button>
      </div>

      {video && (
        <VideoModal
          url={video.exercise?.video_url ?? null}
          title={video.label}
          onClose={() => setVideo(null)}
        />
      )}
    </div>
  )
}
