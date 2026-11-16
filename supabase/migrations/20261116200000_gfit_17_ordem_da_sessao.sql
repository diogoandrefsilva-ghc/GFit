-- ============================================================
-- GFit — a ordem em que se faz o treino, escolhida por quem treina
-- ============================================================
--
-- O treinador escreve o treino como séries seguidas ou como circuito, e isso
-- continua a ser o ponto de partida. Mas quem treina é que sabe como está o
-- ginásio nesse dia: antes de começar escolhe se faz série a série ou em
-- circuito (uma série de cada exercício, e repete), e a escolha fica na
-- sessão — sai-se, volta-se, e o treino continua da mesma maneira.
--
-- Nulo quer dizer "como está escrito no treino".

alter table gfit.workout_sessions
  add column if not exists flow text check (flow in ('sets', 'circuit'));

comment on column gfit.workout_sessions.flow is
  'A ordem escolhida para esta sessão: sets = série a série; circuit = uma série de cada exercício, volta a volta. Nulo: a do treino (plan_days.flow).';
