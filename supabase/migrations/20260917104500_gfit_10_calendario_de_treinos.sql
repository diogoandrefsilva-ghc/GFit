-- ============================================================
-- GFit — calendário de treinos
-- ============================================================
--
-- Até aqui o plano dizia o que fazer mas não dizia quando: o aluno abria a
-- lista de treinos e escolhia um, e o treinador não tinha maneira de dizer
-- "o A é à segunda e à quinta". Esta migração acrescenta a marcação.
--
-- Um plano fechado (publicado) marca-se no calendário: cada marcação liga um
-- treino do plano a uma data. O mesmo treino pode aparecer em várias datas — é
-- disso que se faz uma semana — e a mesma data pode ter mais do que um treino.
--
-- A sessão que o aluno faz passa a poder apontar à marcação que a originou,
-- para se saber o que foi feito a horas, o que foi feito noutro dia e o que
-- ficou por fazer.

create table gfit.scheduled_workouts (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references gfit.profiles(id)   on delete cascade,
  coach_id     uuid not null references gfit.profiles(id)   on delete cascade,
  plan_id      uuid not null references gfit.plans(id)      on delete cascade,
  plan_day_id  uuid not null references gfit.plan_days(id)  on delete cascade,
  scheduled_on date not null,
  notes        text,
  created_at   timestamptz not null default now(),
  -- o mesmo treino duas vezes no mesmo dia seria sempre engano
  unique (plan_day_id, scheduled_on)
);
create index scheduled_workouts_athlete_idx
  on gfit.scheduled_workouts (athlete_id, scheduled_on);
create index scheduled_workouts_coach_idx
  on gfit.scheduled_workouts (coach_id, scheduled_on);
create index scheduled_workouts_plan_idx
  on gfit.scheduled_workouts (plan_id, scheduled_on);

comment on table gfit.scheduled_workouts is
  'Um treino do plano marcado numa data do calendário.';

alter table gfit.workout_sessions
  add column if not exists scheduled_id uuid
    references gfit.scheduled_workouts(id) on delete set null;

comment on column gfit.workout_sessions.scheduled_id is
  'A marcação que deu origem à sessão. Nulo quando o aluno treinou por sua conta.';

-- Uma semana podia ter um treino A só; com calendário pode ter o A à segunda e
-- outra vez à quinta. O que não pode haver é a mesma sessão duas vezes no mesmo
-- dia, e é isso que o índice passa a garantir.
drop index if exists gfit.workout_sessions_day_week_uq;
create unique index workout_sessions_day_date_uq
  on gfit.workout_sessions (athlete_id, plan_day_id, session_date)
  where plan_day_id is not null;

create unique index workout_sessions_scheduled_uq
  on gfit.workout_sessions (scheduled_id)
  where scheduled_id is not null;

-- ---------- RLS ----------
alter table gfit.scheduled_workouts enable row level security;

-- O aluno vê as marcações dos planos que já vê (as de rascunho ficam de fora
-- pela política de `plans`), o treinador vê as dos seus alunos.
create policy scheduled_workouts_select on gfit.scheduled_workouts
  for select to authenticated
  using (
    gfit.can_access_athlete(athlete_id)
    and exists (select 1 from gfit.plans p where p.id = plan_id)
  );

create policy scheduled_workouts_coach_write on gfit.scheduled_workouts
  for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.is_my_athlete(athlete_id));

grant select, insert, update, delete on gfit.scheduled_workouts to authenticated;
