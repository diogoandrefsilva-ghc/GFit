-- ============================================================
-- GFit — o tema com que a app abre, por pessoa
-- ============================================================
--
-- A app tem temas (Papel, Caderno, Arena, Guerreiro), escolhidos no Perfil e
-- guardados no telemóvel. Faltava o ponto de partida: o Filipe Guerreiro e os
-- alunos dele devem entrar já com o tema Guerreiro, e depois mudar se
-- quiserem.
--
-- `profiles.theme` é esse ponto de partida — o tema com que a app abre para a
-- pessoa enquanto ela não escolher outro no telemóvel. A escolha no telemóvel
-- ganha sempre; isto só decide o que se vê antes dela.
--
-- De onde vem:
--   * o treinador tem o tema da casa dele, que vem de `app_config`
--     (`house_themes`: email → tema), tal como os treinadores e os
--     administradores vêm de `coach_emails` e `admin_emails`. Assim fica
--     atribuído antes de ele ter conta.
--   * o aluno herda o do seu treinador, a cada login: se o treinador mudar de
--     tema da casa, os alunos acompanham.

alter table gfit.profiles
  add column if not exists theme text
    check (theme in ('papel', 'caderno', 'arena', 'guerreiro'));

comment on column gfit.profiles.theme is
  'Tema com que a app abre para esta pessoa enquanto ela não escolher outro no telemóvel. Treinador: de app_config.house_themes. Aluno: o do treinador.';

insert into gfit.app_config (key, value)
values ('house_themes', '{"filipeguerreiro1988@gmail.com": "guerreiro"}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- quem já tem perfil: o treinador pela lista, os alunos pelo treinador
update gfit.profiles p
   set theme = c.value->>lower(p.email), updated_at = now()
  from gfit.app_config c
 where c.key = 'house_themes'
   and c.value ? lower(coalesce(p.email, ''));

update gfit.profiles a
   set theme = t.theme, updated_at = now()
  from gfit.profiles t
 where t.id = a.coach_id
   and t.theme is not null
   and a.theme is distinct from t.theme;

-- ensure_profile() passa a pôr o tema da casa, sem mexer em mais nada do que a
-- versão anterior (migração 12)
create or replace function gfit.ensure_profile()
returns gfit.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid          uuid := (select auth.uid());
  u            record;
  prof         gfit.profiles;
  inv          gfit.invites;
  coach_emails jsonb;
  admin_emails jsonb;
  house        text;
  is_coach     boolean;
  should_admin boolean;
  display_name text;
  avatar       text;
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;

  select id, email, raw_user_meta_data into u from auth.users where id = uid;

  display_name := coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  );
  avatar := nullif(u.raw_user_meta_data->>'avatar_url', '');

  select value into coach_emails from gfit.app_config where key = 'coach_emails';
  is_coach := coach_emails is not null and exists (
    select 1 from jsonb_array_elements_text(coach_emails) e
    where lower(e) = lower(coalesce(u.email, ''))
  );

  select value into admin_emails from gfit.app_config where key = 'admin_emails';
  should_admin := admin_emails is not null and exists (
    select 1 from jsonb_array_elements_text(admin_emails) e
    where lower(e) = lower(coalesce(u.email, ''))
  );

  -- o tema da casa de quem está na lista (só faz sentido para treinadores,
  -- mas a lista é por email e o papel pode vir depois, por convite)
  select value->>lower(coalesce(u.email, '')) into house
    from gfit.app_config where key = 'house_themes';

  select * into prof from gfit.profiles where id = uid;

  if found then
    update gfit.profiles
       set email      = coalesce(u.email, email),
           full_name  = coalesce(nullif(full_name, ''), display_name),
           avatar_url = coalesce(avatar, avatar_url),
           -- o email entrou na lista de treinadores/administradores depois
           -- deste perfil existir
           role       = case when is_coach then 'coach' else role end,
           status     = case when is_coach then 'active' else status end,
           coach_id   = case when is_coach then null else coach_id end,
           is_admin   = case when should_admin then true else is_admin end,
           -- o da lista; senão o do treinador, que pode ter mudado; senão fica
           theme      = coalesce(
             house,
             (select t.theme from gfit.profiles t
               where t.id = prof.coach_id and not is_coach),
             theme
           ),
           updated_at = now()
     where id = uid
     returning * into prof;
    return prof;
  end if;

  if is_coach then
    insert into gfit.profiles (id, full_name, email, avatar_url, role, status, is_admin, theme)
    values (uid, display_name, u.email, avatar, 'coach', 'active', should_admin, house)
    on conflict (id) do update set updated_at = now()
    returning * into prof;
    return prof;
  end if;

  -- convite pendente para este email
  select * into inv
    from gfit.invites
   where status = 'pending'
     and lower(email) = lower(coalesce(u.email, ''))
   order by created_at
   limit 1;

  if found then
    -- um convite de treinador não fica preso a quem o enviou
    insert into gfit.profiles (id, full_name, email, avatar_url, role, coach_id, status, is_admin, theme)
    values (uid, coalesce(nullif(inv.full_name, ''), display_name), u.email, avatar,
            inv.role,
            case when inv.role = 'coach' then null else inv.coach_id end,
            'active', should_admin,
            coalesce(
              house,
              case when inv.role = 'athlete' then
                (select t.theme from gfit.profiles t where t.id = inv.coach_id)
              end
            ))
    on conflict (id) do update set updated_at = now()
    returning * into prof;

    update gfit.invites
       set status = 'accepted', accepted_by = uid, accepted_at = now()
     where id = inv.id and status = 'pending';

    return prof;
  end if;

  -- sem convite: fica à espera
  insert into gfit.profiles (id, full_name, email, avatar_url, role, status, is_admin, theme)
  values (uid, display_name, u.email, avatar, 'athlete', 'pending', should_admin, house)
  on conflict (id) do update set updated_at = now()
  returning * into prof;
  return prof;
end;
$$;

-- claim_pending_invite: quem estava à espera e é convidado por um treinador
-- passa a herdar o tema dele, como quem entra já com convite (migração 06)
create or replace function gfit.claim_pending_invite()
returns gfit.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  prof gfit.profiles;
  inv  gfit.invites;
begin
  select * into prof from gfit.profiles where id = uid;
  if not found or prof.coach_id is not null or prof.role = 'coach' then
    return prof;
  end if;

  select * into inv
    from gfit.invites
   where status = 'pending'
     and lower(email) = lower(coalesce(prof.email, ''))
   order by created_at
   limit 1;

  if not found then
    return prof;
  end if;

  update gfit.profiles
     set role      = inv.role,
         coach_id  = case when inv.role = 'coach' then null else inv.coach_id end,
         status    = 'active',
         full_name = coalesce(nullif(prof.full_name, ''), inv.full_name),
         theme     = coalesce(
           case when inv.role = 'athlete' then
             (select t.theme from gfit.profiles t where t.id = inv.coach_id)
           end,
           prof.theme
         ),
         updated_at = now()
   where id = uid
   returning * into prof;

  update gfit.invites
     set status = 'accepted', accepted_by = uid, accepted_at = now()
   where id = inv.id and status = 'pending';

  return prof;
end;
$$;
