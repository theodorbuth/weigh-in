-- Weigh In — fixes from Supabase's database advisor.

-- 1. RLS helper functions move to a schema the Data API doesn't expose, so they can't be
--    called as /rest/v1/rpc/… . Policies reference functions by id, so they keep working.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.app_user_id() set schema private;
alter function public.is_member(int) set schema private;
alter function public.round_revealed_for(int, int) set schema private;

-- Functions inside create_project/join_project refer to public.app_user_id(); recreate them
-- pointing at the new location.
create or replace function public.create_project(
  p_name text,
  p_password text,
  p_categories jsonb default '[]'::jsonb,
  p_invite_code text default null
)
returns table (project_id int, invite_code char(8))
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me   int := private.app_user_id();
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

create or replace function public.join_project(p_code text, p_password text)
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me  int := private.app_user_id();
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

-- is_member() calls app_user_id(); point it at the new schema too.
create or replace function private.is_member(p_project_id int)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where project_id = p_project_id and user_id = private.app_user_id()
  )
$$;

-- 2. Trigger functions are only for triggers — nobody calls them directly.
revoke execute on function public.handle_new_auth_user(), public.sync_team_size() from authenticated, anon, public;

-- 3. One policy per action (avoids overlapping SELECT policies).
drop policy "open_work: members write" on public.open_work;
create policy "open_work: members add" on public.open_work
  for insert to authenticated with check (private.is_member(project_id));
create policy "open_work: members edit" on public.open_work
  for update to authenticated using (private.is_member(project_id)) with check (private.is_member(project_id));
create policy "open_work: members remove" on public.open_work
  for delete to authenticated using (private.is_member(project_id));

drop policy "links: members write" on public.links;
create policy "links: members add" on public.links
  for insert to authenticated with check (private.is_member(project_id));
create policy "links: members edit" on public.links
  for update to authenticated using (private.is_member(project_id)) with check (private.is_member(project_id));
create policy "links: members remove" on public.links
  for delete to authenticated using (private.is_member(project_id));
