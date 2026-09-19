import { supabase } from './supabase'
import { unwrap } from './useQuery'
import { daysBetween, isoDate, weekStart } from './format'
import { weekOfPlan } from './calc'
import type {
  AthleteLimitation,
  AthleteProfile,
  AthleteTargets,
  CoachNote,
  Food,
  Invite,
  Muscle,
  DailyLog,
  DietItem,
  DietMeal,
  DietPlan,
  Exercise,
  Measurement,
  Plan,
  PlanDay,
  PlanExercise,
  PlanStatus,
  Profile,
  Role,
  ScheduledWorkout,
  SetLog,
  WeightDirection,
  WeeklyFeedback,
  WorkoutSession,
} from './database.types'

/** Plano de treino activo do aluno, já com dias e exercícios. */
export interface ActivePlan {
  plan: Plan
  days: PlanDay[]
  exercisesByDay: Map<string, PlanExercise[]>
  library: Map<string, Exercise>
}

/** Um plano escrito pela própria pessoa: o autor e o dono são o mesmo. */
export function isSelfPlan(plan: { athlete_id: string; coach_id: string }): boolean {
  return plan.athlete_id === plan.coach_id
}

/**
 * O plano que manda no dia a dia do aluno. Com auto-treino a mesma pessoa pode
 * ter dois planos a correr — o que o treinador lhe escreveu e o que escreveu
 * para si —, e nesse caso o do treinador é que é o plano: o auto-treino vive à
 * parte, na lista dos "meus treinos". Quem não tem treinador só tem os seus.
 */
export async function fetchActivePlan(
  athleteId: string,
  { includeDrafts = false } = {},
): Promise<ActivePlan | null> {
  let query = supabase
    .from('plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: false })
    .limit(8)

  query = includeDrafts
    ? query.in('status', ['published', 'draft'])
    : query.eq('status', 'published')

  const plans = unwrap(await query)
  const plan = plans.find((item) => !isSelfPlan(item)) ?? plans[0]
  if (!plan) return null

  return loadPlanContents(plan)
}

/** Os planos que a própria pessoa escreveu para si, do mais recente ao mais antigo. */
export async function fetchSelfPlans(athleteId: string): Promise<Plan[]> {
  const plans = unwrap(
    await supabase
      .from('plans')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('coach_id', athleteId)
      .neq('status', 'archived')
      .order('start_date', { ascending: false }),
  )
  return plans
}

/**
 * Um plano concreto, e não o mais recente. É o que a sessão a decorrer precisa:
 * um treino marcado há três semanas pode ser de um plano que entretanto deixou
 * de ser o último.
 */
export async function fetchPlanById(planId: string): Promise<ActivePlan | null> {
  const plans = unwrap(await supabase.from('plans').select('*').eq('id', planId).limit(1))
  return plans[0] ? loadPlanContents(plans[0]) : null
}

async function loadPlanContents(plan: Plan): Promise<ActivePlan> {
  const days = unwrap(
    await supabase
      .from('plan_days')
      .select('*')
      .eq('plan_id', plan.id)
      .order('sort_order'),
  )

  const dayIds = days.map((day) => day.id)
  const planExercises = dayIds.length
    ? unwrap(
        await supabase
          .from('plan_exercises')
          .select('*')
          .in('plan_day_id', dayIds)
          .order('sort_order'),
      )
    : []

  const exercisesByDay = new Map<string, PlanExercise[]>()
  for (const day of days) exercisesByDay.set(day.id, [])
  for (const item of planExercises) {
    exercisesByDay.get(item.plan_day_id)?.push(item)
  }

  return { plan, days, exercisesByDay, library: await fetchExercisesByIds(planExercises) }
}

async function fetchExercisesByIds(
  planExercises: PlanExercise[],
): Promise<Map<string, Exercise>> {
  const ids = [
    ...new Set(
      planExercises
        .map((item) => item.exercise_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (ids.length === 0) return new Map()

  const rows = unwrap(await supabase.from('exercises').select('*').in('id', ids))
  return new Map(rows.map((row) => [row.id, row]))
}

export async function fetchDailyLog(
  athleteId: string,
  date = isoDate(),
): Promise<DailyLog | null> {
  const rows = unwrap(
    await supabase
      .from('daily_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('log_date', date)
      .limit(1),
  )
  return rows[0] ?? null
}

export async function saveDailyLog(
  athleteId: string,
  date: string,
  patch: Partial<DailyLog>,
): Promise<DailyLog> {
  const rows = unwrap(
    await supabase
      .from('daily_logs')
      .upsert(
        { athlete_id: athleteId, log_date: date, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'athlete_id,log_date' },
      )
      .select(),
  )
  return rows[0]
}

export async function fetchRecentLogs(
  athleteId: string,
  days = 56,
): Promise<DailyLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return unwrap(
    await supabase
      .from('daily_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('log_date', isoDate(since))
      .order('log_date'),
  )
}

export async function fetchMeasurements(athleteId: string): Promise<Measurement[]> {
  return unwrap(
    await supabase
      .from('measurements')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('measured_on', { ascending: false }),
  )
}

export async function fetchAthleteProfile(
  athleteId: string,
): Promise<AthleteProfile | null> {
  const rows = unwrap(
    await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('athlete_id', athleteId)
      .limit(1),
  )
  return rows[0] ?? null
}

/** As metas em vigor hoje. */
export async function fetchCurrentTargets(
  athleteId: string,
): Promise<AthleteTargets | null> {
  const rows = unwrap(
    await supabase
      .from('athlete_current_targets')
      .select('*')
      .eq('athlete_id', athleteId)
      .limit(1),
  )
  return rows[0] ?? null
}

/** Todas as revisões de metas, da mais recente para a mais antiga. */
export async function fetchTargetsHistory(
  athleteId: string,
): Promise<AthleteTargets[]> {
  return unwrap(
    await supabase
      .from('athlete_targets')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('effective_from', { ascending: false }),
  )
}

export async function saveTargets(
  athleteId: string,
  coachId: string,
  values: Partial<AthleteTargets> & { effective_from: string },
): Promise<AthleteTargets> {
  const rows = unwrap(
    await supabase
      .from('athlete_targets')
      .upsert(
        { ...values, athlete_id: athleteId, created_by: coachId },
        { onConflict: 'athlete_id,effective_from' },
      )
      .select(),
  )
  return rows[0]
}

export async function deleteTargets(id: string): Promise<void> {
  unwrap(await supabase.from('athlete_targets').delete().eq('id', id).select())
}

/** Limitações: as que ainda vigoram primeiro, depois as resolvidas. */
export async function fetchLimitations(
  athleteId: string,
): Promise<AthleteLimitation[]> {
  return unwrap(
    await supabase
      .from('athlete_limitations')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('resolved_on', { ascending: true, nullsFirst: true })
      .order('started_on', { ascending: false }),
  )
}

export async function addLimitation(
  athleteId: string,
  coachId: string,
  body: string,
  startedOn: string,
): Promise<AthleteLimitation> {
  const rows = unwrap(
    await supabase
      .from('athlete_limitations')
      .insert({
        athlete_id: athleteId,
        created_by: coachId,
        body,
        started_on: startedOn,
      })
      .select(),
  )
  return rows[0]
}

export async function resolveLimitation(
  id: string,
  resolvedOn: string | null,
): Promise<void> {
  unwrap(
    await supabase
      .from('athlete_limitations')
      .update({ resolved_on: resolvedOn })
      .eq('id', id)
      .select(),
  )
}

export async function deleteLimitation(id: string): Promise<void> {
  unwrap(await supabase.from('athlete_limitations').delete().eq('id', id).select())
}

/** Todas as notas do treinador, que são o histórico de conselhos do dia. */
export async function fetchCoachNotes(
  athleteId: string,
  limit = 30,
): Promise<CoachNote[]> {
  return unwrap(
    await supabase
      .from('coach_notes')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('note_date', { ascending: false })
      .limit(limit),
  )
}

export async function fetchLatestCoachNote(
  athleteId: string,
): Promise<CoachNote | null> {
  const rows = unwrap(
    await supabase
      .from('coach_notes')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('note_date', { ascending: false })
      .limit(1),
  )
  return rows[0] ?? null
}

export async function fetchCoach(coachId: string): Promise<Profile | null> {
  const rows = unwrap(
    await supabase.from('profiles').select('*').eq('id', coachId).limit(1),
  )
  return rows[0] ?? null
}

/** Sessões de uma semana do plano, para saber o que já foi feito. */
export async function fetchWeekSessions(
  athleteId: string,
  planId: string,
  week: number,
): Promise<WorkoutSession[]> {
  return unwrap(
    await supabase
      .from('workout_sessions')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('plan_id', planId)
      .eq('week_number', week)
      .order('session_date'),
  )
}

export async function fetchSessionSets(sessionId: string): Promise<SetLog[]> {
  return unwrap(
    await supabase
      .from('set_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('set_number'),
  )
}

/**
 * As séries que o aluno fez da última vez neste exercício, para ter a
 * referência ao lado enquanto treina — é a coluna "semana passada" da planilha.
 */
export async function fetchPreviousSets(
  athleteId: string,
  planExerciseId: string,
  beforeSessionId: string,
): Promise<SetLog[]> {
  const sessions = unwrap(
    await supabase
      .from('workout_sessions')
      .select('id, session_date')
      .eq('athlete_id', athleteId)
      .neq('id', beforeSessionId)
      .order('session_date', { ascending: false })
      .limit(30),
  )
  if (sessions.length === 0) return []

  const rows = unwrap(
    await supabase
      .from('set_logs')
      .select('*')
      .eq('plan_exercise_id', planExerciseId)
      .in(
        'session_id',
        sessions.map((session) => session.id),
      )
      .order('set_number'),
  )
  if (rows.length === 0) return []

  // Fica só a sessão mais recente das que aparecerem.
  const order = new Map(sessions.map((session, index) => [session.id, index]))
  const newest = rows.reduce((best, row) => {
    const rank = order.get(row.session_id) ?? Infinity
    const bestRank = order.get(best) ?? Infinity
    return rank < bestRank ? row.session_id : best
  }, rows[0].session_id)

  return rows.filter((row) => row.session_id === newest)
}

export async function startSession(
  athleteId: string,
  plan: Plan,
  dayId: string,
  schedule?: ScheduledWorkout | null,
): Promise<WorkoutSession> {
  const today = isoDate()
  const week = weekOfPlan(plan.start_date, today)

  // Uma marcação dá uma sessão só, mesmo que o aluno a abra em dias diferentes.
  if (schedule) {
    const linked = unwrap(
      await supabase
        .from('workout_sessions')
        .select('*')
        .eq('scheduled_id', schedule.id)
        .limit(1),
    )
    if (linked[0]) return linked[0]
  }

  // Se já se começou hoje este treino, continua-se essa sessão em vez de
  // começar outra — o índice único na base garante o mesmo.
  const existing = unwrap(
    await supabase
      .from('workout_sessions')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('plan_day_id', dayId)
      .eq('session_date', today)
      .limit(1),
  )
  if (existing[0]) {
    if (!schedule || existing[0].scheduled_id) return existing[0]
    // O aluno abriu o treino pela lista e só depois pelo calendário: liga-se a
    // sessão que já existe à marcação, em vez de ficarem as duas soltas.
    const linked = unwrap(
      await supabase
        .from('workout_sessions')
        .update({ scheduled_id: schedule.id })
        .eq('id', existing[0].id)
        .select(),
    )
    return linked[0] ?? existing[0]
  }

  const rows = unwrap(
    await supabase
      .from('workout_sessions')
      .insert({
        athlete_id: athleteId,
        plan_id: plan.id,
        plan_day_id: dayId,
        scheduled_id: schedule?.id ?? null,
        week_number: week,
        session_date: today,
        started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .select(),
  )
  return rows[0]
}

// ── calendário ───────────────────────────────────────────────────────

/** Uma marcação do calendário com o treino a que se refere e o que se fez. */
export interface CalendarEntry {
  schedule: ScheduledWorkout
  plan: Plan | null
  day: PlanDay | null
  /** A sessão que a cumpriu, se já houver. */
  session: WorkoutSession | null
  exerciseCount: number
  /** Só no calendário do treinador, onde há vários alunos à mistura. */
  athlete: Profile | null
}

export async function fetchAthleteCalendar(
  athleteId: string,
  from: string,
  to: string,
): Promise<CalendarEntry[]> {
  const schedules = unwrap(
    await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('scheduled_on', from)
      .lte('scheduled_on', to)
      .order('scheduled_on'),
  )
  return decorateSchedules(schedules, { withAthletes: false })
}

/**
 * A semana do treinador. Não filtra por `coach_id`: o que interessa é de quem é
 * o treino, não quem o marcou — senão os auto-treinos dos alunos ficavam de
 * fora, que é precisamente o que o treinador quer ver. Quem pode ver o quê já
 * está decidido no RLS (os seus alunos, e ele próprio).
 */
export async function fetchCoachCalendar(
  from: string,
  to: string,
): Promise<CalendarEntry[]> {
  const schedules = unwrap(
    await supabase
      .from('scheduled_workouts')
      .select('*')
      .gte('scheduled_on', from)
      .lte('scheduled_on', to)
      .order('scheduled_on'),
  )
  return decorateSchedules(schedules, { withAthletes: true })
}

/**
 * Junta a cada marcação o treino, o plano e a sessão que a cumpriu. São
 * consultas em lote sobre a janela toda, para uma semana de calendário não
 * disparar um pedido por dia.
 */
async function decorateSchedules(
  schedules: ScheduledWorkout[],
  { withAthletes }: { withAthletes: boolean },
): Promise<CalendarEntry[]> {
  if (schedules.length === 0) return []

  const dayIds = [...new Set(schedules.map((row) => row.plan_day_id))]
  const planIds = [...new Set(schedules.map((row) => row.plan_id))]
  const athleteIds = [...new Set(schedules.map((row) => row.athlete_id))]
  const dates = schedules.map((row) => row.scheduled_on).sort()

  const [days, plans, exercises, inRange, linked, athletes] = await Promise.all([
    unwrap(await supabase.from('plan_days').select('*').in('id', dayIds)),
    unwrap(await supabase.from('plans').select('*').in('id', planIds)),
    unwrap(
      await supabase.from('plan_exercises').select('id, plan_day_id').in('plan_day_id', dayIds),
    ),
    // As sessões do intervalo: uma sessão começada antes de a marcação existir
    // não lhe aponta, e reconhece-se pelo treino e pelo dia.
    unwrap(
      await supabase
        .from('workout_sessions')
        .select('*')
        .in('athlete_id', athleteIds)
        .gte('session_date', dates[0])
        .lte('session_date', dates[dates.length - 1]),
    ),
    // E as que apontam à marcação, tenham acontecido no dia ou não: um treino
    // de segunda feito na quarta continua a ser o treino de segunda.
    unwrap(
      await supabase
        .from('workout_sessions')
        .select('*')
        .in(
          'scheduled_id',
          schedules.map((row) => row.id),
        ),
    ),
    withAthletes
      ? unwrap(await supabase.from('profiles').select('*').in('id', athleteIds))
      : Promise.resolve([] as Profile[]),
  ])

  const sessions = [
    ...linked,
    ...inRange.filter((session) => !linked.some((row) => row.id === session.id)),
  ]

  const dayById = new Map(days.map((day) => [day.id, day]))
  const planById = new Map(plans.map((plan) => [plan.id, plan]))
  const athleteById = new Map(athletes.map((profile) => [profile.id, profile]))

  const exerciseCounts = new Map<string, number>()
  for (const item of exercises) {
    exerciseCounts.set(item.plan_day_id, (exerciseCounts.get(item.plan_day_id) ?? 0) + 1)
  }

  const byScheduleId = new Map(
    sessions
      .filter((session) => session.scheduled_id)
      .map((session) => [session.scheduled_id as string, session]),
  )

  return schedules.map((schedule) => ({
    schedule,
    plan: planById.get(schedule.plan_id) ?? null,
    day: dayById.get(schedule.plan_day_id) ?? null,
    exerciseCount: exerciseCounts.get(schedule.plan_day_id) ?? 0,
    athlete: athleteById.get(schedule.athlete_id) ?? null,
    session:
      byScheduleId.get(schedule.id) ??
      sessions.find(
        (session) =>
          !session.scheduled_id &&
          session.athlete_id === schedule.athlete_id &&
          session.plan_day_id === schedule.plan_day_id &&
          session.session_date === schedule.scheduled_on,
      ) ??
      null,
  }))
}

/** As marcações de um plano, que é o que o editor do plano mostra. */
export async function fetchPlanSchedule(planId: string): Promise<ScheduledWorkout[]> {
  return unwrap(
    await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('plan_id', planId)
      .order('scheduled_on'),
  )
}

/**
 * Marca treinos no calendário. Repetir uma marcação que já existe não é erro
 * nem duplica — é o que acontece ao aplicar um padrão semanal por cima do que
 * já estava marcado.
 */
export async function scheduleWorkouts(
  rows: {
    athlete_id: string
    coach_id: string
    plan_id: string
    plan_day_id: string
    scheduled_on: string
  }[],
): Promise<void> {
  if (rows.length === 0) return
  unwrap(
    await supabase
      .from('scheduled_workouts')
      .upsert(rows, { onConflict: 'plan_day_id,scheduled_on', ignoreDuplicates: true })
      .select(),
  )
}

export async function unscheduleWorkout(id: string): Promise<void> {
  unwrap(await supabase.from('scheduled_workouts').delete().eq('id', id).select())
}

export async function saveSet(
  sessionId: string,
  planExerciseId: string,
  exerciseId: string | null,
  setNumber: number,
  values: {
    weight_kg?: number | null
    reps?: number | null
    rir?: number | null
    duration_s?: number | null
  },
): Promise<SetLog> {
  const rows = unwrap(
    await supabase
      .from('set_logs')
      .upsert(
        {
          session_id: sessionId,
          plan_exercise_id: planExerciseId,
          exercise_id: exerciseId,
          set_number: setNumber,
          done: true,
          ...values,
        },
        { onConflict: 'session_id,plan_exercise_id,set_number' },
      )
      .select(),
  )
  return rows[0]
}

/** Grava de uma vez as séries cronometradas de um treino guiado. */
export async function saveTimedSets(
  sessionId: string,
  rows: {
    planExerciseId: string
    exerciseId: string | null
    setNumber: number
    seconds: number
  }[],
): Promise<void> {
  if (rows.length === 0) return
  unwrap(
    await supabase
      .from('set_logs')
      .upsert(
        rows.map((row) => ({
          session_id: sessionId,
          plan_exercise_id: row.planExerciseId,
          exercise_id: row.exerciseId,
          set_number: row.setNumber,
          duration_s: row.seconds,
          done: true,
        })),
        { onConflict: 'session_id,plan_exercise_id,set_number' },
      )
      .select(),
  )
}

export async function finishSession(
  sessionId: string,
  startedAt: string | null,
): Promise<void> {
  const finishedAt = new Date()
  const duration = startedAt
    ? Math.round((finishedAt.getTime() - new Date(startedAt).getTime()) / 1000)
    : null

  unwrap(
    await supabase
      .from('workout_sessions')
      .update({
        status: 'done',
        finished_at: finishedAt.toISOString(),
        duration_s: duration,
      })
      .eq('id', sessionId)
      .select(),
  )
}

/** Plano alimentar publicado, com refeições e itens. */
export interface DietDetail {
  plan: DietPlan
  meals: DietMeal[]
  itemsByMeal: Map<string, DietItem[]>
}

export async function fetchDietPlan(
  athleteId: string,
  { includeDrafts = false } = {},
): Promise<DietDetail | null> {
  let query = supabase
    .from('diet_plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(1)

  query = includeDrafts
    ? query.in('status', ['published', 'draft'])
    : query.eq('status', 'published')

  const plans = unwrap(await query)
  const plan = plans[0]
  if (!plan) return null

  return { plan, ...(await fetchDietContents(plan.id)) }
}

export async function fetchDietContents(dietPlanId: string) {
  const meals = unwrap(
    await supabase
      .from('diet_meals')
      .select('*')
      .eq('diet_plan_id', dietPlanId)
      .order('sort_order'),
  )

  const mealIds = meals.map((meal) => meal.id)
  const items = mealIds.length
    ? unwrap(
        await supabase
          .from('diet_items')
          .select('*')
          .in('meal_id', mealIds)
          .order('sort_order'),
      )
    : []

  const itemsByMeal = new Map<string, DietItem[]>()
  for (const meal of meals) itemsByMeal.set(meal.id, [])
  for (const item of items) itemsByMeal.get(item.meal_id)?.push(item)

  return { meals, itemsByMeal }
}

export async function fetchWeeklyFeedback(
  athleteId: string,
  week = weekStart(),
): Promise<WeeklyFeedback | null> {
  const rows = unwrap(
    await supabase
      .from('weekly_feedback')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('week_start', week)
      .limit(1),
  )
  return rows[0] ?? null
}

export async function fetchFeedbackHistory(
  athleteId: string,
  limit = 8,
): Promise<WeeklyFeedback[]> {
  return unwrap(
    await supabase
      .from('weekly_feedback')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('week_start', { ascending: false })
      .limit(limit),
  )
}

export async function saveWeeklyFeedback(
  athleteId: string,
  week: string,
  patch: Partial<WeeklyFeedback>,
): Promise<WeeklyFeedback> {
  const rows = unwrap(
    await supabase
      .from('weekly_feedback')
      .upsert(
        { athlete_id: athleteId, week_start: week, ...patch },
        { onConflict: 'athlete_id,week_start' },
      )
      .select(),
  )
  return rows[0]
}

// ── lado do treinador ────────────────────────────────────────────────

/** Um aluno com o resumo que o treinador precisa de ver na lista. */
export interface AthleteSummary {
  profile: Profile
  plan: Plan | null
  week: number
  sessionsDone: number
  sessionsPlanned: number
  lastLog: DailyLog | null
  weightChange: number | null
  unreadFeedback: WeeklyFeedback | null
  lastSeen: string | null
  /** Para que lado o peso deve ir, para saber se a variação é boa notícia. */
  weightDirection: WeightDirection | null
  /** Quantos treinos o aluno escreveu para si próprio. */
  selfPlans: number
}

/** Porque é que um aluno precisa de atenção — null quando está tudo em dia. */
export function attentionReason(summary: AthleteSummary): string | null {
  if (summary.unreadFeedback) return 'Feedback por ler'
  // Sem plano prescrito, mas a treinar por sua conta: é uma escolha do aluno,
  // não um esquecimento do treinador. O resto — silêncio, treinos em falta —
  // continua a contar como em qualquer outro aluno.
  if (!summary.plan && summary.selfPlans === 0) return 'Sem plano publicado'
  if (summary.plan && summary.plan.num_weeks - summary.week <= 0) {
    return 'Plano a acabar'
  }

  const missed = summary.sessionsPlanned - summary.sessionsDone
  // Só a partir de sexta é que faltarem treinos quer mesmo dizer alguma coisa.
  if (new Date().getDay() >= 5 && missed > 1) {
    return `${missed} treinos em falta`
  }

  if (!summary.lastSeen) return 'Ainda sem registos'
  const silent = daysBetween(summary.lastSeen, isoDate())
  if (silent >= 4) return `Sem registos há ${silent} dias`

  return null
}

export async function fetchAthletes(coachId: string): Promise<Profile[]> {
  return unwrap(
    await supabase
      .from('profiles')
      .select('*')
      .eq('coach_id', coachId)
      .order('full_name'),
  )
}

/**
 * Junta, para cada aluno, o estado do plano, os treinos da semana e o feedback
 * por ler. São consultas em lote por cima de todos os alunos, para a lista não
 * disparar uma rajada de pedidos por linha.
 */
export async function fetchAthleteSummaries(
  coachId: string,
): Promise<AthleteSummary[]> {
  const athletes = await fetchAthletes(coachId)
  if (athletes.length === 0) return []

  const ids = athletes.map((athlete) => athlete.id)
  const since = new Date()
  since.setDate(since.getDate() - 60)

  const [plans, sessions, logs, feedback, targets] = await Promise.all([
    unwrap(
      await supabase
        .from('plans')
        .select('*')
        .in('athlete_id', ids)
        .order('start_date', { ascending: false }),
    ),
    unwrap(
      await supabase
        .from('workout_sessions')
        .select('*')
        .in('athlete_id', ids)
        .gte('session_date', isoDate(since)),
    ),
    unwrap(
      await supabase
        .from('daily_logs')
        .select('*')
        .in('athlete_id', ids)
        .gte('log_date', isoDate(since))
        .order('log_date'),
    ),
    unwrap(
      await supabase
        .from('weekly_feedback')
        .select('*')
        .in('athlete_id', ids)
        .eq('status', 'sent')
        .order('week_start', { ascending: false }),
    ),
    unwrap(
      await supabase
        .from('athlete_current_targets')
        .select('athlete_id, weight_direction')
        .in('athlete_id', ids),
    ),
  ])

  const directionOf = new Map(
    targets.map((row) => [row.athlete_id, row.weight_direction]),
  )

  const planDayCounts = await countPlanDays(plans.map((plan) => plan.id))

  return athletes.map((athlete) => {
    const published = plans.filter(
      (item) => item.athlete_id === athlete.id && item.status === 'published',
    )
    // O plano do aluno é o que o treinador lhe escreveu. Os auto-treinos contam
    // à parte: quem treina por sua conta continua a ser um aluno sem plano
    // prescrito, e é isso que a lista tem de dizer.
    const plan = published.find((item) => !isSelfPlan(item)) ?? null

    const week = plan ? weekOfPlan(plan.start_date, isoDate()) : 1
    const mySessions = sessions.filter(
      (session) =>
        session.athlete_id === athlete.id &&
        session.plan_id === plan?.id &&
        session.week_number === week,
    )

    const myLogs = logs.filter((log) => log.athlete_id === athlete.id)
    const weights = myLogs
      .map((log) => log.weight_kg)
      .filter((value): value is number => value !== null)

    const unread =
      feedback.find(
        (entry) => entry.athlete_id === athlete.id && entry.read_at === null,
      ) ?? null

    return {
      profile: athlete,
      plan,
      week,
      sessionsDone: mySessions.filter((session) => session.status === 'done').length,
      sessionsPlanned: plan ? planDayCounts.get(plan.id) ?? 0 : 0,
      lastLog: myLogs[myLogs.length - 1] ?? null,
      weightChange:
        weights.length > 1 ? weights[weights.length - 1] - weights[0] : null,
      unreadFeedback: unread,
      lastSeen: myLogs[myLogs.length - 1]?.log_date ?? null,
      weightDirection: directionOf.get(athlete.id) ?? null,
      selfPlans: published.filter(isSelfPlan).length,
    }
  })
}

async function countPlanDays(planIds: string[]): Promise<Map<string, number>> {
  if (planIds.length === 0) return new Map()
  const days = unwrap(
    await supabase.from('plan_days').select('id, plan_id').in('plan_id', planIds),
  )
  const dayIds = days.map((day) => day.id)
  const exercises = dayIds.length
    ? unwrap(
        await supabase.from('plan_exercises').select('plan_day_id').in('plan_day_id', dayIds),
      )
    : []
  // Um dia sem exercícios é só um espaço reservado (ex.: B/C nunca preenchidos) — não conta como treino.
  const daysWithExercises = new Set(exercises.map((exercise) => exercise.plan_day_id))

  const counts = new Map<string, number>()
  for (const day of days) {
    if (!daysWithExercises.has(day.id)) continue
    counts.set(day.plan_id, (counts.get(day.plan_id) ?? 0) + 1)
  }
  return counts
}

export async function fetchPlansFor(athleteId: string): Promise<Plan[]> {
  return unwrap(
    await supabase
      .from('plans')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('start_date', { ascending: false }),
  )
}

export async function fetchDietPlansFor(athleteId: string): Promise<DietPlan[]> {
  return unwrap(
    await supabase
      .from('diet_plans')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false }),
  )
}

export async function createPlan(
  coachId: string,
  athleteId: string,
  values: { name: string; block_name: string | null; num_weeks: number; start_date: string },
  status: PlanStatus = 'draft',
): Promise<Plan> {
  const plans = unwrap(
    await supabase
      .from('plans')
      .insert({
        ...values,
        coach_id: coachId,
        athlete_id: athleteId,
        status,
        published_at: status === 'published' ? new Date().toISOString() : null,
      })
      .select(),
  )
  const plan = plans[0]

  // Um plano vazio não serve para nada; começa com os três treinos do costume.
  unwrap(
    await supabase
      .from('plan_days')
      .insert(
        ['A', 'B', 'C'].map((label, index) => ({
          plan_id: plan.id,
          label,
          sort_order: index,
        })),
      )
      .select(),
  )
  return plan
}

/**
 * Um auto-treino nasce publicado. O rascunho existe para o plano não chegar ao
 * aluno antes de estar pronto, e aqui quem escreve é quem o vai fazer — não há
 * ninguém a quem esconder o que ainda está a meio.
 */
export async function createSelfPlan(
  athleteId: string,
  values: { name: string; block_name: string | null; num_weeks: number; start_date: string },
): Promise<Plan> {
  return createPlan(athleteId, athleteId, values, 'published')
}

export async function fetchPlanDetail(planId: string) {
  const plans = unwrap(await supabase.from('plans').select('*').eq('id', planId).limit(1))
  const plan = plans[0]
  if (!plan) throw new Error('Plano não encontrado.')

  const days = unwrap(
    await supabase.from('plan_days').select('*').eq('plan_id', planId).order('sort_order'),
  )
  const dayIds = days.map((day) => day.id)
  const planExercises = dayIds.length
    ? unwrap(
        await supabase
          .from('plan_exercises')
          .select('*')
          .in('plan_day_id', dayIds)
          .order('sort_order'),
      )
    : []

  const exerciseIds = [
    ...new Set(
      planExercises
        .map((item) => item.exercise_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const library = exerciseIds.length
    ? unwrap(await supabase.from('exercises').select('*').in('id', exerciseIds))
    : []

  const athletes = unwrap(
    await supabase.from('profiles').select('*').eq('id', plan.athlete_id).limit(1),
  )

  const exercisesByDay = new Map<string, PlanExercise[]>()
  for (const day of days) exercisesByDay.set(day.id, [])
  for (const item of planExercises) exercisesByDay.get(item.plan_day_id)?.push(item)

  return {
    plan,
    days,
    exercisesByDay,
    library: new Map(library.map((exercise) => [exercise.id, exercise])),
    athlete: athletes[0] ?? null,
  }
}

export async function searchExercises(
  term: string,
  filters: { muscle?: string | null; pattern?: string | null } = {},
): Promise<Exercise[]> {
  let query = supabase.from('exercises').select('*').order('name').limit(120)

  const normalized = term.trim().toLowerCase()
  if (normalized) query = query.like('search_name', `%${normalized}%`)
  if (filters.muscle) query = query.eq('primary_muscle', filters.muscle)
  if (filters.pattern) query = query.eq('pattern', filters.pattern)

  return unwrap(await query)
}

export async function searchFoods(term: string): Promise<Food[]> {
  let query = supabase.from('foods').select('*').order('name').limit(60)
  const normalized = term.trim().toLowerCase()
  if (normalized) query = query.like('search_name', `%${normalized}%`)
  return unwrap(await query)
}

export async function fetchMuscles(): Promise<Muscle[]> {
  return unwrap(await supabase.from('muscles').select('*').order('sort_order'))
}

export async function addExerciseToDay(
  dayId: string,
  exercise: Exercise,
  sortOrder: number,
): Promise<PlanExercise> {
  const rows = unwrap(
    await supabase
      .from('plan_exercises')
      .insert({
        plan_day_id: dayId,
        exercise_id: exercise.id,
        sort_order: sortOrder,
        sets: 3,
        rep_min: 8,
        rep_max: 12,
        rest_seconds: 90,
      })
      .select(),
  )
  return rows[0]
}

export async function updatePlanExercise(
  id: string,
  patch: Partial<PlanExercise>,
): Promise<void> {
  unwrap(await supabase.from('plan_exercises').update(patch).eq('id', id).select())
}

export async function removePlanExercise(id: string): Promise<void> {
  unwrap(await supabase.from('plan_exercises').delete().eq('id', id).select())
}

export async function publishPlan(planId: string): Promise<void> {
  unwrap(
    await supabase
      .from('plans')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', planId)
      .select(),
  )
}

export async function saveCoachNote(
  coachId: string,
  athleteId: string,
  body: string,
): Promise<CoachNote> {
  const rows = unwrap(
    await supabase
      .from('coach_notes')
      .insert({ coach_id: coachId, athlete_id: athleteId, body, note_date: isoDate() })
      .select(),
  )
  return rows[0]
}

export async function replyToFeedback(
  feedbackId: string,
  reply: string,
): Promise<void> {
  unwrap(
    await supabase
      .from('weekly_feedback')
      .update({
        coach_reply: reply,
        coach_replied_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
      })
      .eq('id', feedbackId)
      .select(),
  )
}

export async function markFeedbackRead(feedbackId: string): Promise<void> {
  unwrap(
    await supabase
      .from('weekly_feedback')
      .update({ read_at: new Date().toISOString() })
      .eq('id', feedbackId)
      .select(),
  )
}

/**
 * Deixar de esperar por um convite e passar a treinar por sua conta. Não apaga
 * nada nem fecha portas: o convite que chegar depois continua a ligar a pessoa
 * ao treinador.
 */
export async function startTrainingAlone(profileId: string): Promise<void> {
  unwrap(
    await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', profileId)
      .select(),
  )
}

export async function fetchInvites(coachId: string): Promise<Invite[]> {
  return unwrap(
    await supabase
      .from('invites')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false }),
  )
}

export async function createInvite(
  coachId: string,
  email: string,
  fullName: string | null,
  role: Role = 'athlete',
): Promise<Invite> {
  const rows = unwrap(
    await supabase
      .from('invites')
      .insert({
        coach_id: coachId,
        email: email.trim().toLowerCase(),
        full_name: fullName,
        role,
      })
      .select(),
  )
  return rows[0]
}

export async function revokeInvite(inviteId: string): Promise<void> {
  unwrap(
    await supabase.from('invites').update({ status: 'revoked' }).eq('id', inviteId).select(),
  )
}

export async function saveAthleteProfile(
  athleteId: string,
  patch: Partial<AthleteProfile>,
): Promise<AthleteProfile> {
  const rows = unwrap(
    await supabase
      .from('athlete_profiles')
      .upsert(
        { athlete_id: athleteId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'athlete_id' },
      )
      .select(),
  )
  return rows[0]
}
