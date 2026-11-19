-- Weigh In — rebalancing (requirement 12): open work, assignment, agreement, lock, carry-over.

-- Rebalancing gets 24 h from the reveal; then cron locks the plan as it stands (if all work is assigned).
alter table public.rounds add column rebalance_closes_at timestamptz;

create or replace function private.reveal_round(p_round_id int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pid int;
begin
  update public.rounds
  set phase = 'revealed', revealed_at = now(), rebalance_closes_at = now() + interval '24 hours'
  where id = p_round_id and phase = 'placing'
  returning project_id into pid;
  if pid is null then
    return;
  end if;

  update public.categories set shared_at = now()
  where project_id = pid and shared_at is null
    and created_by in (select user_id from public.seals where round_id = p_round_id);

  create temp table merge_map on commit drop as
  select id, min(id) over (partition by lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) as keep_id
  from public.categories
  where project_id = pid and shared_at is not null;

  update public.stones s set category_id = m.keep_id
  from merge_map m where s.category_id = m.id and m.id <> m.keep_id;
  update public.open_work w set category_id = m.keep_id
  from merge_map m where w.category_id = m.id and m.id <> m.keep_id;
  delete from public.categories c using merge_map m where c.id = m.id and m.id <> m.keep_id;
  drop table merge_map;
end;
$$;

-- True while the project's current round is revealed / being rebalanced.
create function private.is_rebalancing(p_project_id int)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.rounds
    where project_id = p_project_id and phase in ('revealed', 'rebalancing')
  )
$$;
grant execute on function private.is_rebalancing(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Open work guard: only while rebalancing; only sealed members can be assigned;
-- any change moves the round to 'rebalancing' and clears every "I agree".
-- ---------------------------------------------------------------------------
create function private.open_work_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  w public.open_work := coalesce(new, old);
  ph public.round_phase;
begin
  -- Deletes cascading from a deleted project/round are always allowed.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  select phase into ph from public.rounds where id = w.round_id;
  if ph is distinct from 'revealed' and ph is distinct from 'rebalancing' then
    raise exception 'The plan for this check-in is locked' using errcode = '55000';
  end if;
  if tg_op <> 'DELETE' and new.assigned_to is not null
     and not exists (select 1 from public.seals where round_id = new.round_id and user_id = new.assigned_to) then
    raise exception 'Only members who sealed this check-in can take on work' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' then
    new.created_by := coalesce(new.created_by, private.app_user_id());
  end if;
  return coalesce(new, old);
end;
$$;

create function private.open_work_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rid int := coalesce(new.round_id, old.round_id);
begin
  update public.rounds set phase = 'rebalancing' where id = rid and phase = 'revealed';
  delete from public.agreements where round_id = rid;   -- any plan change clears all agreements
  return null;
end;
$$;

create trigger open_work_guard before insert or update or delete on public.open_work
  for each row execute function private.open_work_guard();
create trigger open_work_changed after insert or update or delete on public.open_work
  for each row execute function private.open_work_changed();

-- ---------------------------------------------------------------------------
-- Lock: phase → locked, and each assigned task becomes a draft stone for its assignee
-- (hours empty — they enter actual time; note = task name; task's category).
-- ---------------------------------------------------------------------------
create function private.lock_plan(p_round_id int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.rounds set phase = 'locked', locked_at = now()
  where id = p_round_id and phase in ('revealed', 'rebalancing');
  if not found then
    return;
  end if;
  insert into public.stones (project_id, user_id, round_id, category_id, hours, note, carried_from)
  select w.project_id, w.assigned_to, null, w.category_id, null, w.name, w.id
  from public.open_work w
  where w.round_id = p_round_id and w.assigned_to is not null;
end;
$$;

create function public.agree(p_round_id int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me int := private.app_user_id();
  r public.rounds;
  agreed int;
  sealed int;
begin
  select * into r from public.rounds where id = p_round_id for update;
  if r.id is null or not private.is_member(r.project_id) then
    raise exception 'Check-in not found' using errcode = '42501';
  end if;
  if r.phase not in ('revealed', 'rebalancing') then
    raise exception 'This plan is already locked' using errcode = '55000';
  end if;
  if not exists (select 1 from public.seals where round_id = r.id and user_id = me) then
    raise exception 'Only members who sealed this check-in agree on the plan' using errcode = '42501';
  end if;
  if exists (select 1 from public.open_work where round_id = r.id and assigned_to is null) then
    raise exception 'Assign all open work first' using errcode = '55000';
  end if;

  insert into public.agreements (round_id, user_id) values (r.id, me);   -- agreeing twice → unique_violation

  select count(*) into agreed from public.agreements where round_id = r.id;
  select count(*) into sealed from public.seals where round_id = r.id;
  if agreed >= sealed then
    perform private.lock_plan(r.id);
  end if;
end;
$$;

-- Cron: also lock plans whose 24 h rebalancing window is over (if nothing is unassigned).
create or replace function private.tick()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r record;
  due timestamptz;
begin
  for r in select id from public.rounds where phase = 'placing' and closes_at <= now() loop
    perform private.reveal_round(r.id);
  end loop;

  for r in
    select id from public.rounds x
    where phase in ('revealed', 'rebalancing') and rebalance_closes_at <= now()
      and not exists (select 1 from public.open_work w where w.round_id = x.id and w.assigned_to is null)
  loop
    perform private.lock_plan(r.id);
  end loop;

  for r in select id, checkin_schedule, schedule_updated_at from public.projects where checkin_schedule is not null loop
    due := private.last_scheduled_instant(r.checkin_schedule);
    if due is not null
       and due >= r.schedule_updated_at
       and not exists (select 1 from public.rounds where project_id = r.id and phase <> 'locked')
       and not exists (select 1 from public.rounds where project_id = r.id and opens_at >= due) then
      perform private.open_round(r.id);
    end if;
  end loop;
end;
$$;

-- Categories created while rebalancing are shared immediately (decided 11/19).
drop policy "categories: create private" on public.categories;
create policy "categories: create" on public.categories
  for insert to authenticated
  with check (
    private.is_member(project_id)
    and created_by = private.app_user_id()
    and (shared_at is null or private.is_rebalancing(project_id))
  );

revoke execute on function private.open_work_guard(), private.open_work_changed(), private.lock_plan(int)
  from public, anon, authenticated;
revoke execute on function public.agree(int) from public, anon;
grant execute on function public.agree(int) to authenticated;

-- Rounds revealed before this migration get the same 24 h window, counted from their reveal.
update public.rounds set rebalance_closes_at = revealed_at + interval '24 hours'
where phase in ('revealed', 'rebalancing') and rebalance_closes_at is null;
