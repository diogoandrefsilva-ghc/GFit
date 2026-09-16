-- ============================================================
-- GFit — configuração, funções de acesso e onboarding
-- ============================================================

create table gfit.app_config (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- emails que recebem o perfil de Treinador no primeiro login
insert into gfit.app_config (key, value)
values ('coach_emails', '[]'::jsonb);

-- ---------- funções de acesso (security definer, sem recursão de RLS) ----------
create or replace function gfit.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from gfit.profiles where id = (select auth.uid());
$$;

create or replace function gfit.my_coach_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coach_id from gfit.profiles where id = (select auth.uid());
$$;

create or replace function gfit.is_my_athlete(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from gfit.profiles
    where id = target and coach_id = (select auth.uid())
  );
$$;

-- o próprio aluno, ou o treinador dele
create or replace function gfit.can_access_athlete(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = (select auth.uid()) or gfit.is_my_athlete(target);
$$;

create or replace function gfit.is_coach()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(gfit.my_role() = 'coach', false);
$$;

-- ---------- onboarding: cria o perfil e consome o convite ----------
-- NOTA: substituída pela migração 05, que passa a promover a treinador quem já
-- tinha perfil quando o email entrou na lista. Fica aqui como estava.
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

  select * into prof from gfit.profiles where id = uid;

  if found then
    -- mantém nome/avatar/email em sincronia com o provedor de login
    update gfit.profiles
       set email      = coalesce(u.email, email),
           full_name  = coalesce(nullif(full_name, ''), display_name),
           avatar_url = coalesce(avatar, avatar_url),
           updated_at = now()
     where id = uid
     returning * into prof;
    return prof;
  end if;

  select value into coach_emails from gfit.app_config where key = 'coach_emails';

  -- 1) email na lista de treinadores
  if coach_emails is not null
     and exists (
       select 1 from jsonb_array_elements_text(coach_emails) e
       where lower(e) = lower(coalesce(u.email, ''))
     )
  then
    insert into gfit.profiles (id, full_name, email, avatar_url, role, status)
    values (uid, display_name, u.email, avatar, 'coach', 'active')
    returning * into prof;
    return prof;
  end if;

  -- 2) convite pendente para este email
  select * into inv
    from gfit.invites
   where status = 'pending'
     and lower(email) = lower(coalesce(u.email, ''))
   order by created_at
   limit 1;

  if found then
    insert into gfit.profiles (id, full_name, email, avatar_url, role, coach_id, status)
    values (uid, coalesce(nullif(inv.full_name, ''), display_name), u.email, avatar,
            'athlete', inv.coach_id, 'active')
    returning * into prof;

    update gfit.invites
       set status = 'accepted', accepted_by = uid, accepted_at = now()
     where id = inv.id;

    return prof;
  end if;

  -- 3) sem convite: fica à espera
  insert into gfit.profiles (id, full_name, email, avatar_url, role, status)
  values (uid, display_name, u.email, avatar, 'athlete', 'pending')
  returning * into prof;
  return prof;
end;
$$;

-- um aluno que se registou antes de ser convidado é ligado quando o convite chega
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
     set coach_id = inv.coach_id,
         status   = 'active',
         full_name = coalesce(nullif(prof.full_name, ''), inv.full_name),
         updated_at = now()
   where id = uid
   returning * into prof;

  update gfit.invites
     set status = 'accepted', accepted_by = uid, accepted_at = now()
   where id = inv.id;

  return prof;
end;
$$;

revoke all on function gfit.ensure_profile()       from public, anon;
revoke all on function gfit.claim_pending_invite() from public, anon;
grant execute on function gfit.ensure_profile()       to authenticated;
grant execute on function gfit.claim_pending_invite() to authenticated;
