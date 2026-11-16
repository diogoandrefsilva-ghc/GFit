-- ============================================================
-- GFit — o segundo feedback do treinador
-- ============================================================
--
-- Quatro coisas que a app não sabia fazer e que o dia de um treinador pede:
--
--   1. TREINO PRESENCIAL. "O David treina sempre às sextas às 12h30." É uma
--      regra, não uma lista de datas: guarda-se o dia da semana e a hora, e o
--      calendário desenha as sessões a partir daí. O aluno diz se vai — por
--      omissão vai — e, se não for, pode propor outra data.
--   2. O TREINADOR REGISTA O TREINO. Num treino presencial quem tem o
--      telemóvel na mão é o treinador. As sessões e as séries passam a poder
--      ser escritas por ele, para os seus alunos.
--   3. MENSALIDADE. O valor fica na ficha; o aluno diz "já paguei" e o
--      treinador valida.
--   4. AVALIAÇÕES. Peso, altura, perímetros, pregas, tensão, frequência
--      cardíaca, mobilidade e os testes de aptidão. O que é conta (IMC, % de
--      massa gorda, VO2máx) não se guarda: sai dos números, na app.

-- ---------- 1. treino presencial ----------

create table gfit.training_slots (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references gfit.profiles(id) on delete cascade,
  coach_id    uuid not null references gfit.profiles(id) on delete cascade,
  -- 0 = domingo … 6 = sábado, como o getDay() do JavaScript
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  -- a partir de quando vale; uma regra criada hoje não inventa sessões no passado
  starts_on   date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (athlete_id, weekday, start_time)
);
create index training_slots_coach_idx on gfit.training_slots (coach_id);

comment on table gfit.training_slots is
  'Treino presencial recorrente: o aluno treina com o treinador neste dia da semana, a esta hora.';

-- A resposta do aluno a uma sessão concreta. Sem linha, vai.
create table gfit.slot_attendance (
  id             uuid primary key default gen_random_uuid(),
  slot_id        uuid not null references gfit.training_slots(id) on delete cascade,
  athlete_id     uuid not null references gfit.profiles(id) on delete cascade,
  session_date   date not null,
  going          boolean not null default true,
  proposed_date  date,
  proposed_time  time,
  note           text,
  -- o que o treinador respondeu à proposta: null = por responder
  proposal_accepted boolean,
  updated_at     timestamptz not null default now(),
  unique (slot_id, session_date)
);
create index slot_attendance_athlete_idx on gfit.slot_attendance (athlete_id, session_date);

comment on table gfit.slot_attendance is
  'Se o aluno vai a uma sessão presencial e, não indo, que outra data propõe.';

alter table gfit.training_slots  enable row level security;
alter table gfit.slot_attendance enable row level security;

create policy training_slots_select on gfit.training_slots for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy training_slots_coach_write on gfit.training_slots for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.is_my_athlete(athlete_id));

-- O aluno responde, o treinador aceita ou recusa a proposta: escrevem os dois.
create policy slot_attendance_select on gfit.slot_attendance for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy slot_attendance_write on gfit.slot_attendance for all to authenticated
  using (gfit.can_access_athlete(athlete_id))
  with check (gfit.can_access_athlete(athlete_id));

grant select, insert, update, delete on gfit.training_slots, gfit.slot_attendance to authenticated;

-- Um treino marcado pode ter hora (os presenciais têm quase sempre).
alter table gfit.scheduled_workouts
  add column if not exists starts_at time;

comment on column gfit.scheduled_workouts.starts_at is
  'Hora do treino, quando a tem. Nulo: é para fazer nesse dia, a qualquer hora.';

-- ---------- 2. o treinador regista o treino do aluno ----------

-- As políticas somam-se: a do aluno fica como está, e junta-se-lhe uma para
-- o treinador. Assim não é preciso apagar nenhuma.
create policy workout_sessions_coach_write on gfit.workout_sessions for all to authenticated
  using (gfit.is_my_athlete(athlete_id))
  with check (gfit.is_my_athlete(athlete_id));

create policy set_logs_coach_write on gfit.set_logs for all to authenticated
  using (exists (select 1 from gfit.workout_sessions s
                 where s.id = session_id and gfit.is_my_athlete(s.athlete_id)))
  with check (exists (select 1 from gfit.workout_sessions s
                 where s.id = session_id and gfit.is_my_athlete(s.athlete_id)));

-- ---------- 3. mensalidade ----------

alter table gfit.athlete_profiles
  add column if not exists monthly_fee numeric(8,2) check (monthly_fee >= 0);

comment on column gfit.athlete_profiles.monthly_fee is
  'Valor da mensalidade, em euros. Nulo: não se acompanha pagamentos deste aluno.';

create table gfit.payments (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references gfit.profiles(id) on delete cascade,
  -- o mês a que diz respeito, sempre no dia 1
  period        date not null check (extract(day from period) = 1),
  amount        numeric(8,2) not null check (amount >= 0),
  -- quando o aluno disse que pagou; nulo se foi o treinador a registar
  paid_at       timestamptz,
  -- quando o treinador validou; nulo = à espera dele
  confirmed_at  timestamptz,
  confirmed_by  uuid references gfit.profiles(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (athlete_id, period)
);

comment on table gfit.payments is
  'Mensalidades: o aluno diz que pagou, o treinador valida.';

alter table gfit.payments enable row level security;

create policy payments_select on gfit.payments for select to authenticated
  using (gfit.can_access_athlete(athlete_id));

-- O aluno diz que pagou e pode voltar atrás, mas só enquanto o treinador não
-- validou — e nunca é ele a validar.
create policy payments_athlete_write on gfit.payments for all to authenticated
  using (athlete_id = (select auth.uid()) and confirmed_at is null)
  with check (athlete_id = (select auth.uid()) and confirmed_at is null);

create policy payments_coach_write on gfit.payments for all to authenticated
  using (gfit.is_my_athlete(athlete_id))
  with check (gfit.is_my_athlete(athlete_id));

grant select, insert, update, delete on gfit.payments to authenticated;

-- ---------- 4. avaliações ----------

create table gfit.assessments (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references gfit.profiles(id) on delete cascade,
  assessed_on   date not null default current_date,
  next_on       date,

  weight_kg     numeric(5,2),
  height_cm     numeric(5,1),

  -- perímetros (cm)
  abdominal_cm  numeric(5,1),
  hip_cm        numeric(5,1),
  arm_r_cm      numeric(5,1),
  arm_l_cm      numeric(5,1),
  mid_thigh_r_cm numeric(5,1),
  mid_thigh_l_cm numeric(5,1),
  calf_r_cm     numeric(5,1),
  calf_l_cm     numeric(5,1),

  -- pregas adiposas (mm). Homens: peito, abdómen, coxa. Mulheres: tricípite,
  -- supra-ilíaca, coxa. Ficam as cinco para a ficha poder mudar sem se perder nada.
  sf_chest_mm      numeric(4,1),
  sf_abdomen_mm    numeric(4,1),
  sf_thigh_mm      numeric(4,1),
  sf_triceps_mm    numeric(4,1),
  sf_suprailiac_mm numeric(4,1),

  -- tensão arterial e frequência cardíaca em repouso
  bp_systolic   smallint,
  bp_diastolic  smallint,
  resting_hr    smallint,

  -- mobilidade do tornozelo: joelho à parede, em cm
  ankle_r_cm    numeric(4,1),
  ankle_l_cm    numeric(4,1),

  -- aptidão neuromuscular
  grip_r_kg     numeric(4,1),
  grip_l_kg     numeric(4,1),
  push_ups      smallint,
  curl_ups      smallint,
  squat_test    smallint,

  -- aptidão cardiorrespiratória: Queen's College step test, FC de recuperação
  step_test_hr  smallint,

  notes         text,
  created_by    uuid references gfit.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (athlete_id, assessed_on)
);

comment on table gfit.assessments is
  'Avaliação física do aluno. IMC, % de massa gorda e VO2máx calculam-se na app a partir destes números.';

alter table gfit.assessments enable row level security;

create policy assessments_select on gfit.assessments for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy assessments_manage on gfit.assessments for all to authenticated
  using (gfit.can_manage_athlete(athlete_id))
  with check (gfit.can_manage_athlete(athlete_id));

grant select, insert, update, delete on gfit.assessments to authenticated;
