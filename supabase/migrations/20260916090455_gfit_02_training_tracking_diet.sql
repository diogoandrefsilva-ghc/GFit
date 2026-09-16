-- ============================================================
-- GFit — treino, registo e dieta
-- ============================================================

-- ---------- plano de treino (mesociclo) ----------
create table gfit.plans (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references gfit.profiles(id) on delete cascade,
  coach_id     uuid not null references gfit.profiles(id) on delete cascade,
  name         text not null default 'Plano',
  block_name   text,                      -- "Bloco Hipertrofia"
  num_weeks    int  not null default 4 check (num_weeks between 1 and 52),
  start_date   date not null default current_date,
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  notes        text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index plans_athlete_idx on gfit.plans (athlete_id, status);

-- ---------- dias do plano (Treino A / B / C) ----------
create table gfit.plan_days (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references gfit.plans(id) on delete cascade,
  label      text not null,              -- 'A'
  title      text,                       -- 'Empurrar'
  sort_order int  not null default 0,
  notes      text,
  unique (plan_id, label)
);
create index plan_days_plan_idx on gfit.plan_days (plan_id, sort_order);

-- ---------- exercícios do plano ----------
create table gfit.plan_exercises (
  id             uuid primary key default gen_random_uuid(),
  plan_day_id    uuid not null references gfit.plan_days(id) on delete cascade,
  exercise_id    uuid references gfit.exercises(id) on delete set null,
  name_override  text,
  sort_order     int  not null default 0,
  sets           int  not null default 3 check (sets between 1 and 20),
  rep_min        int,
  rep_max        int,
  rest_seconds   int  not null default 90,
  superset_group text,
  notes          text
);
create index plan_exercises_day_idx on gfit.plan_exercises (plan_day_id, sort_order);

-- ---------- sessões de treino ----------
create table gfit.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references gfit.profiles(id) on delete cascade,
  plan_id      uuid references gfit.plans(id) on delete set null,
  plan_day_id  uuid references gfit.plan_days(id) on delete set null,
  week_number  int  not null default 1,
  session_date date not null default current_date,
  started_at   timestamptz,
  finished_at  timestamptz,
  duration_s   int,
  status       text not null default 'in_progress'
               check (status in ('in_progress','done','skipped')),
  notes        text,
  created_at   timestamptz not null default now()
);
create index workout_sessions_athlete_idx on gfit.workout_sessions (athlete_id, session_date desc);
create unique index workout_sessions_day_week_uq
  on gfit.workout_sessions (athlete_id, plan_day_id, week_number)
  where plan_day_id is not null;

-- ---------- séries registadas (C / R / F do Excel) ----------
create table gfit.set_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references gfit.workout_sessions(id) on delete cascade,
  plan_exercise_id uuid references gfit.plan_exercises(id) on delete set null,
  exercise_id      uuid references gfit.exercises(id) on delete set null,
  set_number       int  not null check (set_number between 1 and 20),
  weight_kg        numeric(6,2),   -- C (carga)
  reps             int,            -- R (repetições)
  rir              int check (rir between 0 and 10),  -- F (reps em reserva / falha)
  done             boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (session_id, plan_exercise_id, set_number)
);
create index set_logs_session_idx on gfit.set_logs (session_id);
create index set_logs_exercise_idx on gfit.set_logs (exercise_id);

-- ---------- registo diário (folha "Controle de medidas") ----------
create table gfit.daily_logs (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references gfit.profiles(id) on delete cascade,
  log_date    date not null default current_date,
  weight_kg   numeric(5,2),
  steps       int,
  sleep_hours numeric(4,2),
  stress      int check (stress  between 1 and 5),
  energy      int check (energy  between 1 and 5),
  hunger      int check (hunger  between 1 and 5),
  wellbeing   int check (wellbeing between 1 and 5),
  kcal_in     int,
  protein_g   numeric(6,1),
  fat_g       numeric(6,1),
  carb_g      numeric(6,1),
  notes       text,
  updated_at  timestamptz not null default now(),
  unique (athlete_id, log_date)
);
create index daily_logs_athlete_idx on gfit.daily_logs (athlete_id, log_date desc);

-- ---------- perímetros (folha "Perimetros") ----------
create table gfit.measurements (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references gfit.profiles(id) on delete cascade,
  measured_on   date not null default current_date,
  weight_kg     numeric(5,2),
  waist_cm      numeric(5,1),
  glute_cm      numeric(5,1),
  chest_cm      numeric(5,1),
  thigh_r_cm    numeric(5,1),
  thigh_l_cm    numeric(5,1),
  arm_r_cm      numeric(5,1),
  arm_l_cm      numeric(5,1),
  calf_r_cm     numeric(5,1),
  calf_l_cm     numeric(5,1),
  notes         text,
  created_at    timestamptz not null default now(),
  unique (athlete_id, measured_on)
);
create index measurements_athlete_idx on gfit.measurements (athlete_id, measured_on desc);

-- ---------- plano alimentar (folha "Dieta 1") ----------
create table gfit.diet_plans (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null references gfit.profiles(id) on delete cascade,
  coach_id         uuid not null references gfit.profiles(id) on delete cascade,
  name             text not null default 'Plano alimentar',
  variant          text,   -- "Dia de treino" / "Dia de descanso"
  status           text not null default 'draft' check (status in ('draft','published','archived')),
  kcal_target      int,
  protein_target_g int,
  fat_target_g     int,
  carb_target_g    int,
  notes            text,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index diet_plans_athlete_idx on gfit.diet_plans (athlete_id, status);

create table gfit.diet_meals (
  id            uuid primary key default gen_random_uuid(),
  diet_plan_id  uuid not null references gfit.diet_plans(id) on delete cascade,
  name          text not null default 'Refeição',
  sort_order    int  not null default 0,
  time_hint     text,
  notes         text
);
create index diet_meals_plan_idx on gfit.diet_meals (diet_plan_id, sort_order);

create table gfit.diet_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references gfit.diet_meals(id) on delete cascade,
  food_id     uuid references gfit.foods(id) on delete set null,
  name        text not null,          -- snapshot: o plano não muda se o alimento mudar
  quantity    numeric(8,2) not null default 100,
  unit        text not null default 'g',
  protein_g   numeric(7,2) not null default 0,
  fat_g       numeric(7,2) not null default 0,
  carb_g      numeric(7,2) not null default 0,
  sort_order  int not null default 0,
  notes       text
);
create index diet_items_meal_idx on gfit.diet_items (meal_id, sort_order);

-- ---------- feedback semanal ----------
create table gfit.weekly_feedback (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null references gfit.profiles(id) on delete cascade,
  plan_id          uuid references gfit.plans(id) on delete set null,
  week_number      int  not null,
  week_start       date not null,
  overall          text,   -- progressão/regressão
  went_well        text,
  difficulties     text,
  next_week        text,
  motivation       int check (motivation between 1 and 10),
  trainings_done   int,
  trainings_planned int,
  diet_adherence   int check (diet_adherence between 0 and 100),
  status           text not null default 'draft' check (status in ('draft','sent')),
  sent_at          timestamptz,
  coach_reply      text,
  coach_replied_at timestamptz,
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (athlete_id, week_start)
);
create index weekly_feedback_athlete_idx on gfit.weekly_feedback (athlete_id, week_start desc);

-- ---------- notas do treinador ----------
create table gfit.coach_notes (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references gfit.profiles(id) on delete cascade,
  coach_id   uuid not null references gfit.profiles(id) on delete cascade,
  note_date  date not null default current_date,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index coach_notes_athlete_idx on gfit.coach_notes (athlete_id, note_date desc);
