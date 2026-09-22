-- ============================================================
-- GFit — só administradores criam/editam/apagam exercícios
-- ============================================================
--
-- Até aqui qualquer treinador (role = 'coach') podia escrever na biblioteca
-- de exercícios partilhada. Convidar um treinador novo passaria a dar-lhe
-- também esse poder, o que não é a ideia — a biblioteca é para ser mantida
-- por quem a conhece bem. Passa a ser só quem tiver is_admin: hoje o dono da
-- app e o Filipe Guerreiro, o treinador que a vai usar a sério. Os restantes
-- continuam a poder ler e a usar os exercícios nos planos, só não podem
-- mexer na base.

alter table gfit.profiles
  add column if not exists is_admin boolean not null default false;

-- emails promovidos a administrador no primeiro login, tal como já
-- acontece com coach_emails
insert into gfit.app_config (key, value)
values (
  'admin_emails',
  '["diogo.andre.f.silva@gmail.com","filipeguerreiro1988@gmail.com"]'::jsonb
)
on conflict (key) do update set value = excluded.value;

create or replace function gfit.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select is_admin from gfit.profiles where id = (select auth.uid())),
    false
  );
$$;

-- promove quem já tinha perfil e cujo email entrou na lista agora
update gfit.profiles p
   set is_admin = true, updated_at = now()
  from gfit.app_config c
 where c.key = 'admin_emails'
   and not p.is_admin
   and exists (
     select 1 from jsonb_array_elements_text(c.value) e
     where lower(e) = lower(coalesce(p.email, ''))
   );

-- ensure_profile() passa a promover a admin da mesma forma que já promove a
-- treinador, sem mexer em mais nada do que a versão anterior (migração 06)
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
           updated_at = now()
     where id = uid
     returning * into prof;
    return prof;
  end if;

  if is_coach then
    insert into gfit.profiles (id, full_name, email, avatar_url, role, status, is_admin)
    values (uid, display_name, u.email, avatar, 'coach', 'active', should_admin)
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
    insert into gfit.profiles (id, full_name, email, avatar_url, role, coach_id, status, is_admin)
    values (uid, coalesce(nullif(inv.full_name, ''), display_name), u.email, avatar,
            inv.role,
            case when inv.role = 'coach' then null else inv.coach_id end,
            'active', should_admin)
    on conflict (id) do update set updated_at = now()
    returning * into prof;

    update gfit.invites
       set status = 'accepted', accepted_by = uid, accepted_at = now()
     where id = inv.id and status = 'pending';

    return prof;
  end if;

  -- sem convite: fica à espera
  insert into gfit.profiles (id, full_name, email, avatar_url, role, status, is_admin)
  values (uid, display_name, u.email, avatar, 'athlete', 'pending', should_admin)
  on conflict (id) do update set updated_at = now()
  returning * into prof;
  return prof;
end;
$$;

-- exercícios: só administradores escrevem; a leitura mantém-se para todos
drop policy if exists exercises_coach_write on gfit.exercises;
create policy exercises_admin_write on gfit.exercises for all to authenticated
  using (gfit.is_admin())
  with check (gfit.is_admin());
