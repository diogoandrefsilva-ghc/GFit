-- ============================================================
-- GFit — hábitos, refeições feitas e a conversa
-- ============================================================
--
-- Três coisas que faltavam ao dia a dia e que não cabiam no que já havia:
--
--   1. HÁBITOS. O registo do dia é igual para todos — peso, passos, sono. O
--      que o treinador quer acompanhar em cada aluno (a água, a creatina, os
--      alongamentos) é dele e desse aluno. Define-os quem define as metas; o
--      aluno marca-os com um toque.
--   2. REFEIÇÕES. Uma refeição passa a poder ter alternativas ("Opção 2"), e
--      o aluno marca a que comeu. Daí sai a aderência à dieta, em vez de uma
--      percentagem estimada ao domingo.
--   3. CONVERSA. As notas do treinador passam a ter resposta: o aluno escreve
--      no mesmo fio. A tabela é a mesma — uma nota é uma mensagem do treinador.

-- ---------- 1. hábitos ----------

create table gfit.habits (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references gfit.profiles(id) on delete cascade,
  created_by   uuid references gfit.profiles(id) on delete set null,
  name         text not null check (length(btrim(name)) between 1 and 60),
  emoji        text check (emoji is null or length(emoji) <= 16),
  sort_order   int  not null default 0,
  -- um hábito que deixou de se acompanhar não se apaga: o que ficou marcado
  -- continua a contar a história
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index habits_athlete_idx on gfit.habits (athlete_id, sort_order);

comment on table gfit.habits is
  'O que o aluno marca todos os dias além do registo do costume. Define-os quem lhe define as metas.';

-- Um dia em que o hábito foi cumprido. Sem linha, não foi.
create table gfit.habit_logs (
  habit_id    uuid not null references gfit.habits(id) on delete cascade,
  athlete_id  uuid not null references gfit.profiles(id) on delete cascade,
  log_date    date not null default current_date,
  created_at  timestamptz not null default now(),
  primary key (habit_id, log_date)
);
create index habit_logs_athlete_idx on gfit.habit_logs (athlete_id, log_date desc);

alter table gfit.habits     enable row level security;
alter table gfit.habit_logs enable row level security;

create policy habits_select on gfit.habits for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
-- A mesma regra das metas: o treinador, ou o próprio quando não tem treinador.
create policy habits_manage on gfit.habits for all to authenticated
  using (gfit.can_manage_athlete(athlete_id))
  with check (gfit.can_manage_athlete(athlete_id));

create policy habit_logs_select on gfit.habit_logs for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
-- Marcar é do aluno, e só num hábito que seja dele.
create policy habit_logs_athlete_write on gfit.habit_logs for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (
    athlete_id = (select auth.uid())
    and exists (select 1 from gfit.habits h
                where h.id = habit_id and h.athlete_id = (select auth.uid()))
  );

grant select, insert, update, delete on gfit.habits, gfit.habit_logs to authenticated;

-- ---------- 2. refeições: alternativas e o que foi feito ----------

alter table gfit.diet_meals
  add column if not exists alternative_to uuid references gfit.diet_meals(id) on delete cascade;
create index if not exists diet_meals_alternative_idx
  on gfit.diet_meals (alternative_to) where alternative_to is not null;

comment on column gfit.diet_meals.alternative_to is
  'Nulo: é uma refeição do plano. Preenchido: é outra opção para essa refeição, e não soma ao total.';

-- A refeição que o aluno comeu num dia: a do plano, ou uma das alternativas.
create table gfit.meal_logs (
  athlete_id  uuid not null references gfit.profiles(id) on delete cascade,
  log_date    date not null default current_date,
  meal_id     uuid not null references gfit.diet_meals(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (athlete_id, log_date, meal_id)
);

comment on table gfit.meal_logs is
  'Refeições do plano que o aluno marcou como feitas, dia a dia.';

alter table gfit.meal_logs enable row level security;

create policy meal_logs_select on gfit.meal_logs for select to authenticated
  using (gfit.can_access_athlete(athlete_id));
create policy meal_logs_athlete_write on gfit.meal_logs for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

grant select, insert, update, delete on gfit.meal_logs to authenticated;

-- ---------- 3. a conversa ----------

-- Quem escreveu. Até aqui era sempre o `coach_id`; passa a poder ser o aluno.
alter table gfit.coach_notes
  add column if not exists author_id uuid references gfit.profiles(id) on delete cascade;

update gfit.coach_notes set author_id = coach_id where author_id is null;

comment on column gfit.coach_notes.author_id is
  'Quem escreveu a mensagem: o treinador (igual a coach_id) ou o aluno (igual a athlete_id).';
comment on column gfit.coach_notes.read_at is
  'Quando o outro lado a leu: o aluno, numa nota do treinador; o treinador, numa mensagem do aluno.';

-- O autor é quem está a escrever, e não o que o pedido disser: ninguém escreve
-- em nome do outro. Sem sessão (migrações, consola) vale o que vier, e na falta
-- disso o treinador — que é o que as notas antigas sempre foram.
create or replace function gfit.coach_notes_set_author()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.author_id := coalesce((select auth.uid()), new.author_id, new.coach_id);
  return new;
end;
$$;

create trigger coach_notes_set_author
  before insert on gfit.coach_notes
  for each row execute function gfit.coach_notes_set_author();

-- O aluno escreve no seu fio, ao seu treinador. Quem não tem treinador já
-- escrevia a si próprio pela política do autor (coach_id = ele).
create policy coach_notes_athlete_write on gfit.coach_notes for insert to authenticated
  with check (
    athlete_id = (select auth.uid())
    and coach_id = gfit.my_coach_id()
  );

-- As mensagens que o treinador ainda não leu, para o Início.
create index if not exists coach_notes_unread_idx
  on gfit.coach_notes (coach_id) where read_at is null;
