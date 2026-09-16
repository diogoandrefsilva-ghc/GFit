-- ============================================================
-- GFit — treinos por tempo, a par dos treinos por repetições
-- ============================================================
--
-- Até aqui todo o treino era carga e repetições, o que serve para trabalho de
-- força mas deixa de fora pranchas, isometrias e circuitos. Um treino passa a
-- declarar se corre por repetições ou por tempo, e um exercício pode fugir à
-- regra do treino onde está: uma prancha de 45s num dia de cargas, ou uma série
-- de força no meio de um circuito.
--
-- Os treinos por tempo têm duas ordens possíveis, que dão sessões diferentes
-- com os mesmos números:
--
--   'sets'    — o exercício repete-se as suas séries todas antes de se passar
--               ao seguinte (45s, descanso, 45s, descanso, 45s → próximo).
--   'circuit' — percorre-se a lista toda uma vez, descansa-se mais, e repete-se
--               a volta. As voltas são do treino, não do exercício.

alter table gfit.plan_days
  add column if not exists mode text not null default 'reps'
    check (mode in ('reps', 'time')),
  add column if not exists flow text not null default 'sets'
    check (flow in ('sets', 'circuit')),
  -- quantas voltas leva o circuito
  add column if not exists rounds int check (rounds between 1 and 30),
  -- descanso entre voltas, tipicamente maior do que o descanso entre exercícios
  add column if not exists round_rest_seconds int check (round_rest_seconds between 0 and 900);

comment on column gfit.plan_days.mode is
  'Como o treino corre por omissão: repetições ou tempo. Cada exercício pode ter o seu.';
comment on column gfit.plan_days.flow is
  'sets = cada exercício até ao fim antes do seguinte; circuit = a lista toda, X voltas.';

alter table gfit.plan_exercises
  -- nulo significa seguir o modo do treino
  add column if not exists mode text check (mode in ('reps', 'time')),
  add column if not exists work_seconds int check (work_seconds between 1 and 3600);

comment on column gfit.plan_exercises.mode is
  'Excepção ao modo do treino. Nulo segue o treino.';
comment on column gfit.plan_exercises.work_seconds is
  'Duração de cada série quando o exercício corre por tempo.';

-- O que se fez numa série cronometrada é tempo, não repetições.
alter table gfit.set_logs
  add column if not exists duration_s int check (duration_s between 0 and 7200);

comment on column gfit.set_logs.duration_s is
  'Segundos efectivamente feitos. Em circuito, set_number é o número da volta.';
