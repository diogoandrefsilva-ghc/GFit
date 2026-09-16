-- ============================================================
-- GFit — o que muda ao longo do tempo deixa de ser sobrescrito
-- ============================================================
--
-- A ficha do aluno guardava tudo em campos únicos: mudar a meta de calorias
-- apagava a anterior, e ninguém conseguia dizer em que altura é que o objectivo
-- era outro, ou desde quando é que aquela lesão existe. Num acompanhamento que
-- dura meses, é precisamente esse rasto que interessa.
--
-- Fica na ficha só o que não muda — data de nascimento, sexo, altura, profissão.
-- As metas passam a ser revisões datadas, e as limitações uma lista com início e
-- fim. O peso e as medidas já tinham histórico próprio.

-- ---------- o que não muda ----------
alter table gfit.athlete_profiles
  add column if not exists occupation text;

alter table gfit.athlete_profiles
  drop column if exists goal,
  drop column if exists limitations,
  drop column if exists observations,
  drop column if exists steps_goal,
  drop column if exists sleep_goal_hours,
  drop column if exists kcal_target,
  drop column if exists protein_target_g,
  drop column if exists fat_target_g,
  drop column if exists carb_target_g;

-- ---------- metas, revisão a revisão ----------
create table gfit.athlete_targets (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null references gfit.profiles(id) on delete cascade,
  effective_from   date not null default current_date,
  objective        text,                      -- o que se quer neste período
  kcal_target      int,
  protein_target_g int,
  fat_target_g     int,
  carb_target_g    int,
  steps_goal       int,
  sleep_goal_hours numeric(3,1),
  weight_target_kg numeric(5,2),
  notes            text,
  created_by       uuid references gfit.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  -- uma revisão por dia por aluno: reeditar no próprio dia corrige, não duplica
  unique (athlete_id, effective_from)
);
create index athlete_targets_idx
  on gfit.athlete_targets (athlete_id, effective_from desc);

-- as metas em vigor hoje, que é o que quase todos os ecrãs querem
create view gfit.athlete_current_targets
with (security_invoker = on) as
select distinct on (athlete_id) *
from gfit.athlete_targets
where effective_from <= current_date
order by athlete_id, effective_from desc;

-- ---------- limitações, com princípio e fim ----------
create table gfit.athlete_limitations (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references gfit.profiles(id) on delete cascade,
  body        text not null,
  started_on  date not null default current_date,
  resolved_on date,                            -- nulo enquanto durar
  created_by  uuid references gfit.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index athlete_limitations_idx
  on gfit.athlete_limitations (athlete_id, resolved_on nulls first, started_on desc);

-- ---------- RLS: o aluno lê o que é dele, o treinador escreve ----------
alter table gfit.athlete_targets     enable row level security;
alter table gfit.athlete_limitations enable row level security;

create policy athlete_targets_select on gfit.athlete_targets for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy athlete_targets_coach_write on gfit.athlete_targets for all to authenticated
  using (gfit.is_my_athlete(athlete_id))
  with check (gfit.is_my_athlete(athlete_id));

create policy athlete_limitations_select on gfit.athlete_limitations for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy athlete_limitations_coach_write on gfit.athlete_limitations for all to authenticated
  using (gfit.is_my_athlete(athlete_id))
  with check (gfit.is_my_athlete(athlete_id));

grant select, insert, update, delete
  on gfit.athlete_targets, gfit.athlete_limitations to authenticated;
grant select on gfit.athlete_current_targets to authenticated;
