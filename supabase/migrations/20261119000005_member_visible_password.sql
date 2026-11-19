-- Weigh In — members can see their project's password (decided 11/19) so they can
-- share it with teammates. Joining still checks password_hash (bcrypt); this readable
-- copy is only visible to members through the projects row-level security policy.

alter table public.projects add column password text;

grant select (password) on public.projects to authenticated;

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

  insert into public.projects (name, invite_code, password_hash, password, created_by)
  values (btrim(p_name), code, extensions.crypt(p_password, extensions.gen_salt('bf')), p_password, me)
  returning id into pid;

  insert into public.members (project_id, user_id) values (pid, me);

  insert into public.categories (project_id, name, colour, sort_order, created_by, shared_at)
  select pid, btrim(c ->> 'name'), upper(c ->> 'colour'), (ord - 1)::int, me, now()
  from jsonb_array_elements(p_categories) with ordinality as t(c, ord);

  return query select pid, code;
end;
$$;
