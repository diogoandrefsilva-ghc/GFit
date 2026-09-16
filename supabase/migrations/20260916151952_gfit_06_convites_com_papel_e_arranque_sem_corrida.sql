-- ============================================================
-- GFit — convites com papel, e ensure_profile() à prova de corrida
-- ============================================================
--
-- 1) No primeiro login chegavam a correr dois ensure_profile() ao mesmo tempo
--    (o getSession() e o evento SIGNED_IN do redirect do OAuth). Ambos viam a
--    tabela sem perfil e ambos inseriam; o segundo rebentava com
--    "duplicate key value violates unique constraint profiles_pkey" e o
--    utilizador levava com um ecrã de erro, apesar de a conta ter ficado bem
--    criada. Os inserts passam a ter on conflict, e a função a poder correr
--    as vezes que forem precisas sem mudar o resultado.
--
-- 2) Os convites passam a dizer com que papel a pessoa entra. Até aqui um
--    treinador novo só se criava à mão em app_config; agora convida-se como se
--    convida um aluno. A lista coach_emails fica só para o arranque, para haver
--    sempre um primeiro treinador sem ser preciso alguém já lá dentro.

alter table gfit.invites
  add column if not exists role text not null default 'athlete'
    check (role in ('coach','athlete'));

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
  is_coach     boolean;
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

  select * into prof from gfit.profiles where id = uid;

  if found then
    update gfit.profiles
       set email      = coalesce(u.email, email),
           full_name  = coalesce(nullif(full_name, ''), display_name),
           avatar_url = coalesce(avatar, avatar_url),
           -- o email entrou na lista de treinadores depois deste perfil existir
           role       = case when is_coach then 'coach' else role end,
           status     = case when is_coach then 'active' else status end,
           coach_id   = case when is_coach then null else coach_id end,
           updated_at = now()
     where id = uid
     returning * into prof;
    return prof;
  end if;

  if is_coach then
    insert into gfit.profiles (id, full_name, email, avatar_url, role, status)
    values (uid, display_name, u.email, avatar, 'coach', 'active')
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
    insert into gfit.profiles (id, full_name, email, avatar_url, role, coach_id, status)
    values (uid, coalesce(nullif(inv.full_name, ''), display_name), u.email, avatar,
            inv.role,
            case when inv.role = 'coach' then null else inv.coach_id end,
            'active')
    on conflict (id) do update set updated_at = now()
    returning * into prof;

    update gfit.invites
       set status = 'accepted', accepted_by = uid, accepted_at = now()
     where id = inv.id and status = 'pending';

    return prof;
  end if;

  -- sem convite: fica à espera
  insert into gfit.profiles (id, full_name, email, avatar_url, role, status)
  values (uid, display_name, u.email, avatar, 'athlete', 'pending')
  on conflict (id) do update set updated_at = now()
  returning * into prof;
  return prof;
end;
$$;

-- claim_pending_invite passa a honrar o papel do convite, pela mesma razão
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
         updated_at = now()
   where id = uid
   returning * into prof;

  update gfit.invites
     set status = 'accepted', accepted_by = uid, accepted_at = now()
   where id = inv.id and status = 'pending';

  return prof;
end;
$$;
