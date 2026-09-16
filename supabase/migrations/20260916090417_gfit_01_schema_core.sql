-- ============================================================
-- GFit — schema base
-- ============================================================
create schema if not exists gfit;
grant usage on schema gfit to anon, authenticated;

-- normalização para pesquisa sem acentos (sem depender de extensões partilhadas)
create or replace function gfit.norm(txt text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
           lower(coalesce(txt, '')),
           'áàâãäéèêëíìîïóòôõöúùûüçñ',
           'aaaaaeeeeiiiiooooouuuucn'
         );
$$;

-- ---------- perfis ----------
create table gfit.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  role        text not null default 'athlete' check (role in ('coach','athlete')),
  coach_id    uuid references gfit.profiles(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending','active','paused','archived')),
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_coach_idx on gfit.profiles (coach_id);
create index profiles_email_idx on gfit.profiles (lower(email));

-- ---------- convites ----------
create table gfit.invites (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references gfit.profiles(id) on delete cascade,
  email       text not null,
  full_name   text,
  code        text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  status      text not null default 'pending' check (status in ('pending','accepted','revoked')),
  accepted_by uuid references gfit.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index invites_pending_email_uq
  on gfit.invites (lower(email)) where status = 'pending';
create index invites_coach_idx on gfit.invites (coach_id);

-- ---------- ficha do aluno (folha "Base") ----------
create table gfit.athlete_profiles (
  athlete_id       uuid primary key references gfit.profiles(id) on delete cascade,
  birth_date       date,
  sex              text check (sex in ('M','F')),
  height_cm        numeric(5,1),
  start_weight_kg  numeric(5,2),
  activity_level   numeric(4,3),          -- 1.2 … 1.9
  goal             text,                  -- OBJETIVO
  limitations      text,                  -- Limitações
  observations     text,                  -- Observações
  pack_end_date    date,                  -- Fim do Pack
  next_update_date date,                  -- Próxima atualização
  steps_goal       int default 9000,
  sleep_goal_hours numeric(3,1) default 8,
  -- metas definidas pelo treinador (v1 sem cálculo automático)
  kcal_target      int,
  protein_target_g int,
  fat_target_g     int,
  carb_target_g    int,
  updated_at       timestamptz not null default now()
);

-- ---------- biblioteca de exercícios ----------
create table gfit.muscles (
  slug       text primary key,
  name       text not null,
  sort_order int  not null default 0
);

create table gfit.exercises (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  search_name     text generated always as (gfit.norm(name)) stored,
  pattern         text,        -- Puxar / Empurrar / Pernas / …
  category        text,        -- "Biceps curl", "Elevações/puxadas vertical", …
  video_url       text,
  primary_muscle  text references gfit.muscles(slug),
  -- [{"muscle":"biceps","weight":1}, …] contributos de volume como no Excel
  muscles         jsonb not null default '[]'::jsonb,
  equipment       text,
  is_public       boolean not null default true,
  created_by      uuid references gfit.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index exercises_primary_muscle_idx on gfit.exercises (primary_muscle);
create index exercises_pattern_idx on gfit.exercises (pattern);
create index exercises_search_idx on gfit.exercises (search_name text_pattern_ops);

-- ---------- base de alimentos ----------
create table gfit.foods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  search_name text generated always as (gfit.norm(name)) stored,
  base_qty    numeric(8,2) not null default 100,
  unit        text not null default 'g',
  protein_g   numeric(7,2) not null default 0,
  fat_g       numeric(7,2) not null default 0,
  carb_g      numeric(7,2) not null default 0,
  kcal        numeric(7,2) generated always as
                (protein_g * 4 + carb_g * 4 + fat_g * 9) stored,
  is_public   boolean not null default true,
  created_by  uuid references gfit.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index foods_search_idx on gfit.foods (search_name text_pattern_ops);
