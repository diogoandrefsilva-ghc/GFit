/**
 * Tipos da schema `gfit`.
 *
 * Escritos à mão em vez de gerados porque o projeto Supabase é partilhado por
 * várias apps e o dump automático traz as schemas todas. Se mexeres nas
 * migrações, atualiza aqui também.
 *
 * São `type` e não `interface` de propósito: o supabase-js exige que cada linha
 * satisfaça `Record<string, unknown>`, e uma interface não tem index signature
 * implícita. Com interfaces, a schema inteira resolve para `never` e todas as
 * consultas perdem os tipos.
 */

export type Role = 'coach' | 'athlete'
/** Para que lado o peso deve ir no período. */
export type WeightDirection = 'lose' | 'gain' | 'maintain'
/** Se o trabalho se conta em repetições ou em segundos. */
export type WorkMode = 'reps' | 'time'
/** Ordem por que se percorre o treino: exercício a exercício, ou às voltas. */
export type WorkFlow = 'sets' | 'circuit'
export type ProfileStatus = 'pending' | 'active' | 'paused' | 'archived'
export type PlanStatus = 'draft' | 'published' | 'archived'
export type SessionStatus = 'in_progress' | 'done' | 'skipped'
export type InviteStatus = 'pending' | 'accepted' | 'revoked'
export type FeedbackStatus = 'draft' | 'sent'

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: Role
  coach_id: string | null
  status: ProfileStatus
  phone: string | null
  created_at: string
  updated_at: string
}

export type Invite = {
  id: string
  coach_id: string
  email: string
  full_name: string | null
  /** Com que perfil a pessoa entra ao aceitar. */
  role: Role
  code: string
  status: InviteStatus
  accepted_by: string | null
  accepted_at: string | null
  created_at: string
}

/** A ficha guarda só o que não muda ao longo do acompanhamento. */
export type AthleteProfile = {
  athlete_id: string
  birth_date: string | null
  sex: 'M' | 'F' | null
  height_cm: number | null
  occupation: string | null
  start_weight_kg: number | null
  activity_level: number | null
  pack_end_date: string | null
  next_update_date: string | null
  updated_at: string
}

/** Uma revisão de metas. A que vale hoje é a mais recente já em vigor. */
export type AthleteTargets = {
  id: string
  athlete_id: string
  effective_from: string
  objective: string | null
  kcal_target: number | null
  protein_target_g: number | null
  fat_target_g: number | null
  carb_target_g: number | null
  steps_goal: number | null
  sleep_goal_hours: number | null
  weight_target_kg: number | null
  weight_direction: WeightDirection | null
  notes: string | null
  created_by: string | null
  created_at: string
}

/** Lesão, condição ou restrição. Sem `resolved_on`, ainda está a vigorar. */
export type AthleteLimitation = {
  id: string
  athlete_id: string
  body: string
  started_on: string
  resolved_on: string | null
  created_by: string | null
  created_at: string
}

export type Muscle = {
  slug: string
  name: string
  sort_order: number
}

/** Contributo do exercício para o volume de um músculo (1, 0.5 ou 0.3). */
export type MuscleShare = {
  muscle: string
  weight: number
}

export type Exercise = {
  id: string
  name: string
  search_name: string
  pattern: string | null
  category: string | null
  video_url: string | null
  primary_muscle: string | null
  muscles: MuscleShare[]
  equipment: string | null
  is_public: boolean
  created_by: string | null
  created_at: string
}

export type Food = {
  id: string
  name: string
  search_name: string
  base_qty: number
  unit: string
  protein_g: number
  fat_g: number
  carb_g: number
  kcal: number
  is_public: boolean
  created_by: string | null
  created_at: string
}

export type Plan = {
  id: string
  athlete_id: string
  coach_id: string
  name: string
  block_name: string | null
  num_weeks: number
  start_date: string
  status: PlanStatus
  notes: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type PlanDay = {
  id: string
  plan_id: string
  label: string
  title: string | null
  sort_order: number
  notes: string | null
  mode: WorkMode
  flow: WorkFlow
  /** Voltas do circuito. Só conta quando flow é 'circuit'. */
  rounds: number | null
  round_rest_seconds: number | null
}

export type PlanExercise = {
  id: string
  plan_day_id: string
  exercise_id: string | null
  name_override: string | null
  sort_order: number
  sets: number
  rep_min: number | null
  rep_max: number | null
  rest_seconds: number
  superset_group: string | null
  notes: string | null
  /** Excepção ao modo do treino. Nulo segue o treino. */
  mode: WorkMode | null
  /** Duração de cada série quando corre por tempo. */
  work_seconds: number | null
}

/** Um treino do plano marcado numa data do calendário. */
export type ScheduledWorkout = {
  id: string
  athlete_id: string
  coach_id: string
  plan_id: string
  plan_day_id: string
  scheduled_on: string
  notes: string | null
  created_at: string
}

export type WorkoutSession = {
  id: string
  athlete_id: string
  plan_id: string | null
  plan_day_id: string | null
  /** A marcação que deu origem à sessão. Nulo quando o aluno treinou por sua conta. */
  scheduled_id: string | null
  week_number: number
  session_date: string
  started_at: string | null
  finished_at: string | null
  duration_s: number | null
  status: SessionStatus
  notes: string | null
  created_at: string
}

export type SetLog = {
  id: string
  session_id: string
  plan_exercise_id: string | null
  exercise_id: string | null
  set_number: number
  weight_kg: number | null
  reps: number | null
  rir: number | null
  /** Segundos feitos, quando a série é cronometrada. */
  duration_s: number | null
  done: boolean
  created_at: string
}

export type DailyLog = {
  id: string
  athlete_id: string
  log_date: string
  weight_kg: number | null
  steps: number | null
  sleep_hours: number | null
  stress: number | null
  energy: number | null
  hunger: number | null
  wellbeing: number | null
  kcal_in: number | null
  protein_g: number | null
  fat_g: number | null
  carb_g: number | null
  notes: string | null
  updated_at: string
}

export type Measurement = {
  id: string
  athlete_id: string
  measured_on: string
  weight_kg: number | null
  waist_cm: number | null
  glute_cm: number | null
  chest_cm: number | null
  thigh_r_cm: number | null
  thigh_l_cm: number | null
  arm_r_cm: number | null
  arm_l_cm: number | null
  calf_r_cm: number | null
  calf_l_cm: number | null
  notes: string | null
  created_at: string
}

export type DietPlan = {
  id: string
  athlete_id: string
  coach_id: string
  name: string
  variant: string | null
  status: PlanStatus
  kcal_target: number | null
  protein_target_g: number | null
  fat_target_g: number | null
  carb_target_g: number | null
  notes: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type DietMeal = {
  id: string
  diet_plan_id: string
  name: string
  sort_order: number
  time_hint: string | null
  notes: string | null
}

export type DietItem = {
  id: string
  meal_id: string
  food_id: string | null
  name: string
  quantity: number
  unit: string
  protein_g: number
  fat_g: number
  carb_g: number
  sort_order: number
  notes: string | null
}

export type WeeklyFeedback = {
  id: string
  athlete_id: string
  plan_id: string | null
  week_number: number
  week_start: string
  overall: string | null
  went_well: string | null
  difficulties: string | null
  next_week: string | null
  motivation: number | null
  trainings_done: number | null
  trainings_planned: number | null
  diet_adherence: number | null
  status: FeedbackStatus
  sent_at: string | null
  coach_reply: string | null
  coach_replied_at: string | null
  read_at: string | null
  created_at: string
}

export type CoachNote = {
  id: string
  athlete_id: string
  coach_id: string
  note_date: string
  body: string
  read_at: string | null
  created_at: string
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  gfit: {
    Tables: {
      profiles: Table<Profile>
      invites: Table<Invite>
      athlete_profiles: Table<AthleteProfile>
      athlete_targets: Table<AthleteTargets>
      athlete_limitations: Table<AthleteLimitation>
      muscles: Table<Muscle>
      exercises: Table<Exercise>
      foods: Table<Food>
      plans: Table<Plan>
      plan_days: Table<PlanDay>
      plan_exercises: Table<PlanExercise>
      scheduled_workouts: Table<ScheduledWorkout>
      workout_sessions: Table<WorkoutSession>
      set_logs: Table<SetLog>
      daily_logs: Table<DailyLog>
      measurements: Table<Measurement>
      diet_plans: Table<DietPlan>
      diet_meals: Table<DietMeal>
      diet_items: Table<DietItem>
      weekly_feedback: Table<WeeklyFeedback>
      coach_notes: Table<CoachNote>
    }
    Views: {
      athlete_current_targets: {
        Row: AthleteTargets
        Relationships: []
      }
    }
    Functions: {
      ensure_profile: { Args: Record<string, never>; Returns: Profile }
      claim_pending_invite: { Args: Record<string, never>; Returns: Profile }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
