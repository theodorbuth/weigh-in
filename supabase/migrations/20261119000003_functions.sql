-- Weigh In — sign-in linking, team_size upkeep, create/join project.

-- ---------------------------------------------------------------------------
-- Requirement 7: when someone signs in by email link for the first time, find their
-- row in public.users BY EMAIL (seeded demo users already exist) or create one,
-- and link it to the auth account. Every stone then carries that users.id.
-- ---------------------------------------------------------------------------
create function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (auth_id, email)
  values (new.id, lower(new.email))
  on conflict (email) do update set auth_id = excluded.auth_id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- team_size follows the member list automatically (decided 11/19).
-- ---------------------------------------------------------------------------
create function public.sync_team_size()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pid int := coalesce(new.project_id, old.project_id);
begin
  update public.projects
  set team_size = (select count(*) from public.members where project_id = pid)
  where id = pid;
  return null;
end;
$$;

create trigger members_sync_team_size
  after insert or delete on public.members
  for each row execute function public.sync_team_size();

-- ---------------------------------------------------------------------------
-- Invite codes look like WGH-4821.
-- ---------------------------------------------------------------------------
create function public.random_invite_code()
returns char(8)
language sql volatile set search_path = ''
as $$
  select 'WGH-' || lpad((floor(random() * 10000))::int::text, 4, '0')
$$;

-- A free code to show on the New project form before it's submitted.
create function public.suggest_invite_code()
returns char(8)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  code char(8);
begin
  loop
    code := public.random_invite_code();
    exit when not exists (select 1 from public.projects where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_project: project + creator as first member + starting categories, atomically.
-- p_categories: [{"name": "Research", "colour": "#5FB3A8"}, …]
-- p_invite_code: the code shown on the form; if someone took it meanwhile, a new one is picked.
-- ---------------------------------------------------------------------------
create function public.create_project(
  p_name text,
  p_password text,
  p_categories jsonb default '[]'::jsonb,
  p_invite_code text default null
)
returns table (project_id int, invite_code char(8))
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me   int := public.app_user_id();
  code char(8) := upper(btrim(p_invite_code));
  pid  int;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_password is null or length(p_password) < 4 then
    raise exception 'Password must be at least 4 characters' using errcode = '22023';
  end if;

  if code is null or code !~ '^WGH-[0-9]{4}$'
     or exists (select 1 from public.projects p where p.invite_code = code) then
    code := public.suggest_invite_code();
  end if;

  insert into public.projects (name, invite_code, password_hash, created_by)
  values (btrim(p_name), code, extensions.crypt(p_password, extensions.gen_salt('bf')), me)
  returning id into pid;

  insert into public.members (project_id, user_id) values (pid, me);

  insert into public.categories (project_id, name, colour, sort_order, created_by, shared_at)
  select pid, btrim(c ->> 'name'), upper(c ->> 'colour'), (ord - 1)::int, me, now()
  from jsonb_array_elements(p_categories) with ordinality as t(c, ord);

  return query select pid, code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Requirement 3: join in ONE transaction — check code + password, INSERT INTO members.
-- Wrong code/password inserts nothing. Joining twice is NOT swallowed: the primary
-- key on members raises unique_violation (23505), which the app shows as
-- "You're already in this project".
-- ---------------------------------------------------------------------------
create function public.join_project(p_code text, p_password text)
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me  int := public.app_user_id();
  pid int;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select p.id into pid
  from public.projects p
  where p.invite_code = upper(btrim(p_code))
    and p.password_hash = extensions.crypt(p_password, p.password_hash);

  if pid is null then
    raise exception 'Wrong invite code or password' using errcode = '28P01';
  end if;

  insert into public.members (project_id, user_id) values (pid, me);  -- no ON CONFLICT on purpose
  return pid;
end;
$$;

revoke execute on function
  public.handle_new_auth_user(), public.sync_team_size(), public.random_invite_code(),
  public.suggest_invite_code(), public.create_project(text, text, jsonb, text), public.join_project(text, text)
  from public, anon;

grant execute on function
  public.suggest_invite_code(), public.create_project(text, text, jsonb, text), public.join_project(text, text)
  to authenticated;
