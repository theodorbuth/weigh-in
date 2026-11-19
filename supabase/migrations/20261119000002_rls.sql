-- Weigh In — row-level security.
-- Rule of thumb: you see a project's data only if you're a member; you see another
-- member's stones only after their round is revealed AND they sealed (requirement 9).
-- Writes that need several checks (create/join project, seal, …) go through
-- SECURITY DEFINER functions in the next migration instead of direct table access.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can call them without recursing into RLS)
-- ---------------------------------------------------------------------------
create function public.app_user_id()
returns int
language sql stable security definer set search_path = ''
as $$
  select id from public.users where auth_id = auth.uid()
$$;

create function public.is_member(p_project_id int)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where project_id = p_project_id and user_id = public.app_user_id()
  )
$$;

-- True when a sealed stone in this round may be shown to teammates.
create function public.round_revealed_for(p_round_id int, p_user_id int)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.rounds r
    join public.seals s on s.round_id = r.id and s.user_id = p_user_id
    where r.id = p_round_id and r.phase <> 'placing'
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (also on by default for new tables in this project)
-- ---------------------------------------------------------------------------
alter table public.users      enable row level security;
alter table public.projects   enable row level security;
alter table public.members    enable row level security;
alter table public.rounds     enable row level security;
alter table public.seals      enable row level security;
alter table public.categories enable row level security;
alter table public.open_work  enable row level security;
alter table public.stones     enable row level security;
alter table public.agreements enable row level security;
alter table public.links      enable row level security;

-- Signed-out visitors get nothing.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.app_user_id(), public.is_member(int), public.round_revealed_for(int, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- users: yourself and anyone you share a project with. You may only change your name.
-- ---------------------------------------------------------------------------
create policy "users: read self and teammates" on public.users
  for select to authenticated
  using (
    auth_id = (select auth.uid())
    or exists (
      select 1 from public.members m
      where m.user_id = users.id and public.is_member(m.project_id)
    )
  );

create policy "users: update own row" on public.users
  for update to authenticated
  using (auth_id = (select auth.uid()))
  with check (auth_id = (select auth.uid()));

revoke insert, update, delete on public.users from authenticated;
grant update (name) on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- projects: members can read; password_hash is never readable through the API.
-- Created and joined only via create_project() / join_project().
-- ---------------------------------------------------------------------------
create policy "projects: members read" on public.projects
  for select to authenticated
  using (public.is_member(id));

revoke all on public.projects from authenticated;
grant select (id, name, team_size, invite_code, checkin_schedule, created_by, created_at)
  on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- members, rounds, seals: read-only for members; changed only by functions.
-- ---------------------------------------------------------------------------
create policy "members: members read" on public.members
  for select to authenticated
  using (public.is_member(project_id));
revoke insert, update, delete on public.members from authenticated;

create policy "rounds: members read" on public.rounds
  for select to authenticated
  using (public.is_member(project_id));
revoke insert, update, delete on public.rounds from authenticated;

create policy "seals: members read" on public.seals
  for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.is_member(r.project_id)));
revoke insert, update, delete on public.seals from authenticated;

-- ---------------------------------------------------------------------------
-- categories: shared ones are visible to members; private ones only to their creator.
-- ---------------------------------------------------------------------------
create policy "categories: read shared or own" on public.categories
  for select to authenticated
  using (
    public.is_member(project_id)
    and (shared_at is not null or created_by = public.app_user_id())
  );

create policy "categories: create private" on public.categories
  for insert to authenticated
  with check (
    public.is_member(project_id)
    and created_by = public.app_user_id()
    and shared_at is null
  );

create policy "categories: edit own private" on public.categories
  for update to authenticated
  using (created_by = public.app_user_id() and shared_at is null)
  with check (created_by = public.app_user_id() and shared_at is null);

create policy "categories: delete own private" on public.categories
  for delete to authenticated
  using (created_by = public.app_user_id() and shared_at is null);

-- ---------------------------------------------------------------------------
-- stones (requirement 9): your own always; a teammate's only once revealed + sealed.
-- You can only add/edit/remove your own DRAFTS (round_id is null). Sealing is final.
-- ---------------------------------------------------------------------------
create policy "stones: read own or revealed" on public.stones
  for select to authenticated
  using (
    user_id = public.app_user_id()
    or (
      round_id is not null
      and public.is_member(project_id)
      and public.round_revealed_for(round_id, user_id)
    )
  );

create policy "stones: add own draft" on public.stones
  for insert to authenticated
  with check (user_id = public.app_user_id() and round_id is null);

create policy "stones: edit own draft" on public.stones
  for update to authenticated
  using (user_id = public.app_user_id() and round_id is null)
  with check (user_id = public.app_user_id() and round_id is null);

create policy "stones: delete own draft" on public.stones
  for delete to authenticated
  using (user_id = public.app_user_id() and round_id is null);

-- ---------------------------------------------------------------------------
-- open_work, agreements, links: members of the project.
-- (Rebalancing rules — phase checks, clearing agreements — come with that feature.)
-- ---------------------------------------------------------------------------
create policy "open_work: members read" on public.open_work
  for select to authenticated using (public.is_member(project_id));
create policy "open_work: members write" on public.open_work
  for all to authenticated
  using (public.is_member(project_id))
  with check (public.is_member(project_id));

create policy "agreements: members read" on public.agreements
  for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.is_member(r.project_id)));
revoke insert, update, delete on public.agreements from authenticated;

create policy "links: members read" on public.links
  for select to authenticated using (public.is_member(project_id));
create policy "links: members write" on public.links
  for all to authenticated
  using (public.is_member(project_id))
  with check (public.is_member(project_id));
