-- ============================================================
-- GFit — a lista de treinadores passa a valer também para quem já entrou
-- ============================================================
--
-- ensure_profile() só olhava para coach_emails ao CRIAR o perfil. Quem entrasse
-- antes de o email estar na lista ficava aluno para sempre, e a correção da
-- lista não produzia efeito nenhum. Agora, se o email estiver na lista, o
-- perfil é promovido no login seguinte.
--
-- Só promove, nunca despromove: tirar alguém da lista não lhe tira o perfil de
-- treinador, para não haver quem perca o acesso aos seus alunos por causa de
-- uma edição distraída. Para despromover, é à mão.

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
    insert into gfit.profiles (id, full_name, email, avatar_url, role, coach_id, status)
    values (uid, coalesce(nullif(inv.full_name, ''), display_name), u.email, avatar,
            'athlete', inv.coach_id, 'active')
    returning * into prof;

    update gfit.invites
       set status = 'accepted', accepted_by = uid, accepted_at = now()
     where id = inv.id;

    return prof;
  end if;

  -- sem convite: fica à espera
  insert into gfit.profiles (id, full_name, email, avatar_url, role, status)
  values (uid, display_name, u.email, avatar, 'athlete', 'pending')
  returning * into prof;
  return prof;
end;
$$;
