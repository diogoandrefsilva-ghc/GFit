-- ============================================================
-- GFit — auto-treino: quem treina por sua conta
-- ============================================================
--
-- Até aqui a app tinha uma regra implícita: o que se planeia vem sempre de um
-- treinador, e quem não tem treinador não tem nada. Ficavam de fora duas
-- pessoas — o aluno que quer escrever o seu próprio treino, tenha treinador ou
-- não, e o treinador que se quer acompanhar a si próprio como acompanha os
-- alunos.
--
-- Não há tabelas novas. Um auto-treino é um plano em que o autor e o dono são a
-- mesma pessoa (`coach_id = athlete_id`). Isso chega para o distinguir, e deixa
-- o resto — dias, exercícios, marcações, sessões, séries — exactamente como
-- está. Um treinador a acompanhar-se a si próprio é, para a base de dados, um
-- aluno que é o seu próprio treinador.
--
-- São duas perguntas diferentes, e ficam com regras diferentes:
--
--   * QUEM ESCREVE UM PLANO para si próprio — qualquer pessoa, mesmo tendo
--     treinador. É esse o pedido: o aluno faz o seu treino e o treinador
--     continua a vê-lo.
--   * QUEM DEFINE METAS, FICHA E LIMITAÇÕES de alguém — o treinador dessa
--     pessoa. Quem não tem treinador é o seu próprio treinador, e é por aqui
--     que o PT passa a registar objectivos e metas para si. Um aluno com
--     treinador não passa a poder reescrever as metas que o treinador lhe pôs.
--
-- O que o aluno já escrevia sobre si — peso, passos, sono, energia, fome,
-- stress, perímetros, feedback — continua exactamente igual: sempre foi dele.

comment on column gfit.plans.coach_id is
  'Quem escreveu o plano. Igual a athlete_id quando é um auto-treino.';

comment on column gfit.diet_plans.coach_id is
  'Quem escreveu o plano. Igual a athlete_id quando é um auto-plano.';

-- ---------- funções de acesso ----------

-- Quem pode definir metas, ficha e limitações de alguém: o treinador dessa
-- pessoa, ou a própria pessoa quando não tem treinador nenhum.
create or replace function gfit.can_manage_athlete(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select gfit.is_my_athlete(target)
      or (target = (select auth.uid()) and gfit.my_coach_id() is null);
$$;

-- Quem pode ser dono de um plano que eu escrevo: um aluno meu, ou eu próprio.
-- Hoje dá o mesmo que `can_access_athlete`, mas responde a outra pergunta — uma
-- é sobre ler, esta é sobre escrever —, e é por isso que fica à parte.
create or replace function gfit.can_plan_for(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = (select auth.uid()) or gfit.is_my_athlete(target);
$$;

-- ---------- planos de treino ----------
--
-- O treinador passa a ver os auto-treinos dos seus alunos (é o pedido), mas não
-- lhes mexe: escrever continua a ser de quem escreveu. Rascunhos continuam
-- invisíveis a quem não é o autor.
drop policy if exists plans_select on gfit.plans;
create policy plans_select on gfit.plans for select to authenticated
  using (
    coach_id = (select auth.uid())
    or (athlete_id = (select auth.uid()) and status <> 'draft')
    or (gfit.is_my_athlete(athlete_id) and status <> 'draft')
  );

drop policy if exists plans_coach_write on gfit.plans;
create policy plans_author_write on gfit.plans for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.can_plan_for(athlete_id));

-- Os dias e os exercícios já seguiam o autor do plano (`plans.coach_id`), e
-- por isso não mudam.

-- ---------- marcações no calendário ----------
drop policy if exists scheduled_workouts_coach_write on gfit.scheduled_workouts;
create policy scheduled_workouts_author_write on gfit.scheduled_workouts
  for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.can_plan_for(athlete_id));

-- ---------- planos alimentares ----------
-- A mesma forma dos planos de treino, para as duas coisas não divergirem.
drop policy if exists diet_plans_select on gfit.diet_plans;
create policy diet_plans_select on gfit.diet_plans for select to authenticated
  using (
    coach_id = (select auth.uid())
    or (athlete_id = (select auth.uid()) and status <> 'draft')
    or (gfit.is_my_athlete(athlete_id) and status <> 'draft')
  );

drop policy if exists diet_plans_coach_write on gfit.diet_plans;
create policy diet_plans_author_write on gfit.diet_plans for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and gfit.can_plan_for(athlete_id));

-- ---------- ficha, metas e limitações ----------
-- Passam a aceitar quem não tem treinador a escrever sobre si próprio.
drop policy if exists athlete_profiles_coach_write on gfit.athlete_profiles;
create policy athlete_profiles_manage on gfit.athlete_profiles for all to authenticated
  using (gfit.can_manage_athlete(athlete_id))
  with check (gfit.can_manage_athlete(athlete_id));

drop policy if exists athlete_targets_coach_write on gfit.athlete_targets;
create policy athlete_targets_manage on gfit.athlete_targets for all to authenticated
  using (gfit.can_manage_athlete(athlete_id))
  with check (gfit.can_manage_athlete(athlete_id));

drop policy if exists athlete_limitations_coach_write on gfit.athlete_limitations;
create policy athlete_limitations_manage on gfit.athlete_limitations for all to authenticated
  using (gfit.can_manage_athlete(athlete_id))
  with check (gfit.can_manage_athlete(athlete_id));

-- ---------- notas ----------
-- "Notas e conselhos" passam a servir também de caderno de quem treina por sua
-- conta: o autor é o próprio, e o destinatário também.
drop policy if exists coach_notes_coach_write on gfit.coach_notes;
create policy coach_notes_author_write on gfit.coach_notes for all to authenticated
  using (coach_id = (select auth.uid()))
  with check (
    coach_id = (select auth.uid()) and gfit.can_manage_athlete(athlete_id)
  );
