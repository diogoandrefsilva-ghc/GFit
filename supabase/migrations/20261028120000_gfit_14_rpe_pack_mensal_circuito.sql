-- ============================================================
-- GFit — o que veio do primeiro feedback do treinador
-- ============================================================
--
-- RPE na prescrição. O treinador quer escrever a intensidade de cada exercício,
-- e não só séries × repetições: "3 × 8-10 a RPE 8". Vai de 1 a 10, aos meios
-- pontos, e é opcional — sem RPE o exercício lê-se como até aqui.

alter table gfit.plan_exercises
  add column if not exists rpe numeric(3,1) check (rpe between 1 and 10);

comment on column gfit.plan_exercises.rpe is
  'Esforço pedido (RPE 1-10, aos meios pontos). Nulo: sem RPE prescrito.';

-- O pack é mensal e renova sozinho. A data deixa de ser um fim e passa a ser a
-- âncora da renovação: a app mostra a próxima, mês a mês, sem ninguém ter de
-- a mudar. Quem tiver um pack que acaba mesmo desliga a renovação, e a data
-- volta a querer dizer "acaba aqui".

alter table gfit.athlete_profiles
  add column if not exists pack_renews_monthly boolean not null default true;

comment on column gfit.athlete_profiles.pack_renews_monthly is
  'true: pack_end_date é a data de renovação, que se repete todos os meses. false: é o fim.';

-- Circuito também nos treinos de cargas. O 'circuit' já existia para os treinos
-- por tempo; num treino por repetições quer dizer que se regista uma série de
-- cada exercício e se dá a volta, em vez de esgotar um exercício antes do
-- seguinte. Não há nada a mudar no esquema: o check de `flow` não depende de
-- `mode`. Fica só o comentário a dizê-lo.

comment on column gfit.plan_days.flow is
  'sets = cada exercício até ao fim antes do seguinte; circuit = uma série de cada, volta a volta (por tempo: X voltas do treino; por repetições: as séries de cada exercício).';
