import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useProfile, useTrainsAlone } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Loading, ScreenHeader } from '@/components/Screen'
import { RegisterCards } from '@/athlete/RegisterCards'
import {
  fetchActivePlan,
  fetchAthleteCalendar,
  fetchCurrentTargets,
  fetchCoach,
  fetchDailyLog,
  fetchLatestCoachNote,
  fetchLatestMeasurementDate,
  fetchRecentLogs,
  fetchWeekSessions,
  saveDailyLog,
  startSession,
} from '@/lib/api'
import { average, weekOfPlan } from '@/lib/calc'
import {
  addDays,
  isoDate,
  longDate,
  plural,
  shortDate,
  signed,
  weekStart,
  weekdayShort,
} from '@/lib/format'
import { measurementsPath, workoutsPath } from '@/lib/routes'
import { useQuery } from '@/lib/useQuery'
import type { DailyLog } from '@/lib/database.types'
import './today.css'

export function Today() {
  const profile = useProfile()
  const alone = useTrainsAlone()
  const { isCoach } = useAuth()
  const navigate = useNavigate()
  const today = isoDate()
  // O treinador que treina a si próprio vê os mesmos ecrãs, mas a lista de
  // treinos dele vive na área "Eu".
  const workouts = workoutsPath(isCoach)

  const { data, loading, error, reload } = useQuery(['hoje', profile.id, today], async () => {
    const monday = weekStart(today)
    const [plan, log, recent, note, targets, coach, calendar, measuredOn] =
      await Promise.all([
        fetchActivePlan(profile.id),
        fetchDailyLog(profile.id, today),
        fetchRecentLogs(profile.id, 14),
        fetchLatestCoachNote(profile.id),
        fetchCurrentTargets(profile.id),
        profile.coach_id ? fetchCoach(profile.coach_id) : Promise.resolve(null),
        // A semana toda, e não só hoje: é o que permite dizer quando é o
        // próximo treino num dia de descanso.
        fetchAthleteCalendar(profile.id, monday, addDays(monday, 6)),
        // Só a data, para o cartão das medidas dizer quando foi a última vez.
        fetchLatestMeasurementDate(profile.id),
      ])

    const week = plan ? weekOfPlan(plan.plan.start_date, today) : 1
    const sessions = plan
      ? await fetchWeekSessions(profile.id, plan.plan.id, week)
      : []

    return {
      plan,
      log,
      recent,
      note,
      targets,
      coach,
      week,
      sessions,
      calendar,
      measuredOn,
    }
  })

  const [draft, setDraft] = useState<Partial<DailyLog> | null>(null)
  const [saving, setSaving] = useState(false)

  const log = useMemo(
    () => ({ ...(data?.log ?? {}), ...(draft ?? {}) }) as Partial<DailyLog>,
    [data?.log, draft],
  )

  const patch = useCallback(
    async (values: Partial<DailyLog>) => {
      setDraft((previous) => ({ ...previous, ...values }))
      setSaving(true)
      try {
        await saveDailyLog(profile.id, today, { ...log, ...values })
      } finally {
        setSaving(false)
      }
    },
    [profile.id, today, log],
  )

  if (loading) return <Loading label="A carregar o dia" />

  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
        <button type="button" className="btn btn--ghost" onClick={reload}>
          Tentar outra vez
        </button>
      </div>
    )
  }

  const { plan, recent, note, targets, coach, week, sessions, calendar, measuredOn } =
    data!

  // O que o treinador marcou para hoje manda sobre o palpite do plano.
  const todayMarks = calendar.filter((entry) => entry.schedule.scheduled_on === today)
  const marked = todayMarks.find((entry) => entry.session?.status !== 'done') ?? null
  const nextMark =
    calendar.find(
      (entry) =>
        entry.schedule.scheduled_on > today && entry.session?.status !== 'done',
    ) ?? null

  const doneDayIds = new Set(
    sessions.filter((session) => session.status === 'done').map((s) => s.plan_day_id),
  )
  const nextDay =
    plan?.days.find((day) => !doneDayIds.has(day.id)) ?? plan?.days[0] ?? null
  const nextDayExercises = nextDay ? plan!.exercisesByDay.get(nextDay.id) ?? [] : []
  const totalSets = nextDayExercises.reduce((sum, item) => sum + item.sets, 0)

  const weights = recent
    .map((entry) => entry.weight_kg)
    .filter((value): value is number => value !== null)
  const weightAverage = average(weights.slice(-7))
  const lastWeight = log.weight_kg ?? weights[weights.length - 1] ?? null

  const stepsGoal = targets?.steps_goal ?? 9000

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={
          plan
            ? `Semana ${week} de ${plan.plan.num_weeks}${
                plan.plan.block_name ? ` · ${plan.plan.block_name}` : ''
              }`
            : 'Sem plano activo'
        }
        title={longDate(today)}
      />

      {/* ── treino ─────────────────────────────────────── */}
      {/* A letra do treino vai em `data-letter`: a Arena desenha-a em grande
          por trás do cartão, o Caderno num círculo dourado. */}
      {marked ? (
        <section className="card card--ink today__workout" data-letter={marked.day?.label}>
          <div className="card__head">
            <span className="eyebrow today__workout-eyebrow">Treino de hoje</span>
            {marked.session?.status === 'in_progress' && (
              <span className="chip chip--accent">a meio</span>
            )}
          </div>
          <h2 className="today__workout-title">
            Treino {marked.day?.label ?? '?'}
            {marked.day?.title ? ` · ${marked.day.title}` : ''}
          </h2>
          <p className="today__workout-meta">
            {marked.schedule.coach_id === profile.id
              ? 'marcado por ti'
              : 'marcado pelo treinador'}{' '}
            · {plural(marked.exerciseCount, 'exercício', 'exercícios')}
          </p>
          <button
            type="button"
            className="btn btn--accent btn--block"
            disabled={marked.exerciseCount === 0 || !marked.plan || !marked.day}
            onClick={async () => {
              const session = await startSession(
                profile.id,
                marked.plan!,
                marked.day!.id,
                marked.schedule,
              )
              navigate(`/treino/${session.id}`)
            }}
          >
            {marked.exerciseCount === 0
              ? 'Treino ainda sem exercícios'
              : marked.session
                ? 'Continuar treino'
                : 'Começar treino'}
          </button>
        </section>
      ) : todayMarks.length > 0 ? (
        <section className="card card--good today__workout">
          <div className="card__head">
            <span className="eyebrow">Treino de hoje</span>
            <span className="chip chip--good">feito ✓</span>
          </div>
          <p className="subtitle">
            {todayMarks.length === 1
              ? `Treino ${todayMarks[0].day?.label ?? ''} arrumado.`
              : 'Os treinos marcados para hoje estão feitos.'}
          </p>
        </section>
      ) : calendar.length > 0 ? (
        <section className="card card--flat today__workout">
          <span className="eyebrow">Treino de hoje</span>
          <h2 className="today__workout-title">Dia de descanso</h2>
          <p className="today__workout-meta">
            {nextMark
              ? `O próximo é ${weekdayShort(nextMark.schedule.scheduled_on)}, ${shortDate(
                  nextMark.schedule.scheduled_on,
                )} — treino ${nextMark.day?.label ?? ''}.`
              : 'Não tens mais treinos marcados esta semana.'}
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => navigate(workouts)}
          >
            Ver a semana
          </button>
        </section>
      ) : nextDay ? (
        <section className="card card--ink today__workout" data-letter={nextDay.label}>
          <div className="card__head">
            <span className="eyebrow today__workout-eyebrow">Treino de hoje</span>
            {sessions.some((s) => s.status === 'in_progress') && (
              <span className="chip chip--accent">a meio</span>
            )}
          </div>
          <h2 className="today__workout-title">
            Treino {nextDay.label}
            {nextDay.title ? ` · ${nextDay.title}` : ''}
          </h2>
          <p className="today__workout-meta">
            {plural(nextDayExercises.length, 'exercício', 'exercícios')} ·{' '}
            {plural(totalSets, 'série', 'séries')}
          </p>
          <button
            type="button"
            className="btn btn--accent btn--block"
            disabled={nextDayExercises.length === 0}
            onClick={async () => {
              const session = await startSession(profile.id, plan!.plan, nextDay.id)
              navigate(`/treino/${session.id}`)
            }}
          >
            {nextDayExercises.length === 0
              ? 'Treino ainda sem exercícios'
              : 'Começar treino'}
          </button>
        </section>
      ) : (
        <section className="card card--flat">
          <p className="subtitle">
            {alone
              ? 'Ainda não tens treinos. Escreve o teu no separador Treino — sais com um plano, com os exercícios da base.'
              : 'Ainda não tens plano publicado. Assim que o treinador o publicar, aparece aqui. Se quiseres, escreves o teu no separador Treino.'}
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => navigate(workouts)}
          >
            Ir aos treinos
          </button>
        </section>
      )}

      {/* ── registo diário ─────────────────────────────── */}
      <RegisterCards
        log={log}
        saving={saving}
        stepsGoal={stepsGoal}
        lastWeight={lastWeight}
        weightAverage={weightAverage}
        measuredOn={measuredOn}
        onPatch={patch}
        measurementsPath={measurementsPath(isCoach, true)}
      />

      {/* ── nota do treinador ──────────────────────────── */}
      {note && (
        <section className="card card--accent today__note">
          <div className="today__note-head">
            <Avatar
              name={coach?.full_name ?? profile.full_name ?? 'Treinador'}
              url={coach?.avatar_url ?? profile.avatar_url}
              size={34}
              tone="accent"
            />
            <div>
              <span className="eyebrow">
                {note.coach_id === profile.id ? 'A minha nota' : 'Nota do treinador'}
              </span>
              <p className="today__note-body">{note.body}</p>
            </div>
          </div>
        </section>
      )}

      {weights.length > 1 && (
        <p className="today__trend muted">
          Desde o primeiro registo: {signed(weights[weights.length - 1] - weights[0])} kg
        </p>
      )}
    </div>
  )
}
