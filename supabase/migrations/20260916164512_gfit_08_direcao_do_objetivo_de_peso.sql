-- ============================================================
-- GFit — para que lado é que o peso deve ir
-- ============================================================
--
-- A app pintava de verde o peso a descer e de vermelho o peso a subir, o que
-- só está certo para quem quer emagrecer. Para quem anda a ganhar massa, subir
-- é exactamente o objectivo, e estava a ser assinalado como se fosse um erro.
--
-- Cada revisão de metas passa a dizer para que lado é que o peso deve ir, e a
-- cor deixa de ser uma opinião da app sobre o número.

alter table gfit.athlete_targets
  add column if not exists weight_direction text
    check (weight_direction in ('lose', 'gain', 'maintain'));

comment on column gfit.athlete_targets.weight_direction is
  'Para onde o peso deve ir neste período. Nulo quando não interessa ao objectivo.';

-- A vista é select *, mas foi criada antes desta coluna existir e não a traz.
create or replace view gfit.athlete_current_targets
with (security_invoker = on) as
select distinct on (athlete_id) *
from gfit.athlete_targets
where effective_from <= current_date
order by athlete_id, effective_from desc;
