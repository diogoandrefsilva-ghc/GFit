-- ============================================================
-- GFit — RLS
-- ============================================================
alter table gfit.profiles         enable row level security;
alter table gfit.invites          enable row level security;
alter table gfit.athlete_profiles enable row level security;
alter table gfit.muscles          enable row level security;
alter table gfit.exercises        enable row level security;
alter table gfit.foods            enable row level security;
alter table gfit.plans            enable row level security;
alter table gfit.plan_days        enable row level security;
alter table gfit.plan_exercises   enable row level security;
alter table gfit.workout_sessions enable row level security;
alter table gfit.set_logs         enable row level security;
alter table gfit.daily_logs       enable row level security;
alter table gfit.measurements     enable row level security;
alter table gfit.diet_plans       enable row level security;
alter table gfit.diet_meals       enable row level security;
alter table gfit.diet_items       enable row level security;
alter table gfit.weekly_feedback  enable row level security;
alter table gfit.coach_notes      enable row level security;
alter table gfit.app_config       enable row level security;

-- ---------- profiles ----------
create policy profiles_select on gfit.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or coach_id = (select auth.uid())
    or id = gfit.my_coach_id()
  );

create policy profiles_update_self on gfit.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = gfit.my_role());

create policy profiles_update_by_coach on gfit.profiles for update to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and role = 'athlete');

-- ---------- invites ----------
create policy invites_coach_all on gfit.invites for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.is_coach());

-- ---------- athlete_profiles ----------
create policy athlete_profiles_select on gfit.athlete_profiles for select to authenticated
  using (gfit.can_access_athlete(athlete_id));

create policy athlete_profiles_coach_write on gfit.athlete_profiles for all to authenticated
  using (gfit.is_my_athlete(athlete_id))
  with check (gfit.is_my_athlete(athlete_id));

-- ---------- bibliotecas partilhadas ----------
create policy muscles_read on gfit.muscles for select to authenticated using (true);

create policy exercises_read on gfit.exercises for select to authenticated
  using (is_public or created_by = (select auth.uid()));
create policy exercises_coach_write on gfit.exercises for all to authenticated
  using (gfit.is_coach())
  with check (gfit.is_coach());

create policy foods_read on gfit.foods for select to authenticated
  using (is_public or created_by = (select auth.uid()));
create policy foods_coach_write on gfit.foods for all to authenticated
  using (gfit.is_coach())
  with check (gfit.is_coach());

-- ---------- planos de treino ----------
create policy plans_select on gfit.plans for select to authenticated
  using (
    coach_id = (select auth.uid())
    or (athlete_id = (select auth.uid()) and status <> 'draft')
  );
create policy plans_coach_write on gfit.plans for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.is_my_athlete(athlete_id));

create policy plan_days_select on gfit.plan_days for select to authenticated
  using (exists (select 1 from gfit.plans p where p.id = plan_id));
create policy plan_days_coach_write on gfit.plan_days for all to authenticated
  using (exists (select 1 from gfit.plans p
                 where p.id = plan_id and p.coach_id = (select auth.uid())))
  with check (exists (select 1 from gfit.plans p
                 where p.id = plan_id and p.coach_id = (select auth.uid())));

create policy plan_exercises_select on gfit.plan_exercises for select to authenticated
  using (exists (select 1 from gfit.plan_days d where d.id = plan_day_id));
create policy plan_exercises_coach_write on gfit.plan_exercises for all to authenticated
  using (exists (select 1 from gfit.plan_days d join gfit.plans p on p.id = d.plan_id
                 where d.id = plan_day_id and p.coach_id = (select auth.uid())))
  with check (exists (select 1 from gfit.plan_days d join gfit.plans p on p.id = d.plan_id
                 where d.id = plan_day_id and p.coach_id = (select auth.uid())));

-- ---------- sessões e séries (o aluno escreve, o treinador lê) ----------
create policy workout_sessions_select on gfit.workout_sessions for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy workout_sessions_athlete_write on gfit.workout_sessions for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

create policy set_logs_select on gfit.set_logs for select to authenticated
  using (exists (select 1 from gfit.workout_sessions s where s.id = session_id));
create policy set_logs_athlete_write on gfit.set_logs for all to authenticated
  using (exists (select 1 from gfit.workout_sessions s
                 where s.id = session_id and s.athlete_id = (select auth.uid())))
  with check (exists (select 1 from gfit.workout_sessions s
                 where s.id = session_id and s.athlete_id = (select auth.uid())));

-- ---------- registo diário ----------
create policy daily_logs_select on gfit.daily_logs for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy daily_logs_athlete_write on gfit.daily_logs for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

-- ---------- perímetros (aluno ou treinador registam) ----------
create policy measurements_select on gfit.measurements for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy measurements_write on gfit.measurements for all to authenticated
  using (gfit.can_access_athlete(athlete_id))
  with check (gfit.can_access_athlete(athlete_id));

-- ---------- dieta ----------
create policy diet_plans_select on gfit.diet_plans for select to authenticated
  using (
    coach_id = (select auth.uid())
    or (athlete_id = (select auth.uid()) and status <> 'draft')
  );
create policy diet_plans_coach_write on gfit.diet_plans for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.is_my_athlete(athlete_id));

create policy diet_meals_select on gfit.diet_meals for select to authenticated
  using (exists (select 1 from gfit.diet_plans p where p.id = diet_plan_id));
create policy diet_meals_coach_write on gfit.diet_meals for all to authenticated
  using (exists (select 1 from gfit.diet_plans p
                 where p.id = diet_plan_id and p.coach_id = (select auth.uid())))
  with check (exists (select 1 from gfit.diet_plans p
                 where p.id = diet_plan_id and p.coach_id = (select auth.uid())));

create policy diet_items_select on gfit.diet_items for select to authenticated
  using (exists (select 1 from gfit.diet_meals m where m.id = meal_id));
create policy diet_items_coach_write on gfit.diet_items for all to authenticated
  using (exists (select 1 from gfit.diet_meals m join gfit.diet_plans p on p.id = m.diet_plan_id
                 where m.id = meal_id and p.coach_id = (select auth.uid())))
  with check (exists (select 1 from gfit.diet_meals m join gfit.diet_plans p on p.id = m.diet_plan_id
                 where m.id = meal_id and p.coach_id = (select auth.uid())));

-- ---------- feedback semanal ----------
create policy weekly_feedback_select on gfit.weekly_feedback for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy weekly_feedback_athlete_write on gfit.weekly_feedback for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));
create policy weekly_feedback_coach_reply on gfit.weekly_feedback for update to authenticated
  using (gfit.is_my_athlete(athlete_id))
  with check (gfit.is_my_athlete(athlete_id));

-- ---------- notas do treinador ----------
create policy coach_notes_select on gfit.coach_notes for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy coach_notes_coach_write on gfit.coach_notes for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.is_my_athlete(athlete_id));
create policy coach_notes_athlete_mark_read on gfit.coach_notes for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

-- app_config fica fechado (só acessível via funções security definer)

-- ---------- grants ----------
grant select, insert, update, delete on all tables in schema gfit to authenticated;
revoke all on gfit.app_config from authenticated, anon;
grant usage, select on all sequences in schema gfit to authenticated;
