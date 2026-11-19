-- Weigh In — check-in rounds: start, seal, reveal, deadline, weekly schedule.
-- Requirements 9 + 10 (and PDF #7: scheduled events happen even if nobody is logged in).

-- checkin_schedule format: '<weekday 0=Sun..6=Sat> <HH:MM> <IANA timezone>', e.g. '5 17:00 America/New_York'.
alter table public.projects add column schedule_updated_at timestamptz;
grant select (schedule_updated_at) on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (private schema: not callable through the API)
-- ---------------------------------------------------------------------------
create function private.open_round(p_project_id int)
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  rid int;
begin
  insert into public.rounds (project_id, number, opens_at, closes_at)
  select p_project_id, coalesce(max(number), 0) + 1, now(), now() + interval '24 hours'
  from public.rounds where project_id = p_project_id
  returning id into rid;   -- rounds_one_active_per_project rejects a second unlocked round
  return rid;
end;
$$;

-- Reveal a round: phase → revealed, share the sealed members' private categories, and merge
-- shared categories whose names match (case/space-insensitive) into the earliest one.
create function private.reveal_round(p_round_id int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pid int;
begin
  update public.rounds set phase = 'revealed', revealed_at = now()
  where id = p_round_id and phase = 'placing'
  returning project_id into pid;
  if pid is null then
    return;  -- already revealed
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

-- Most recent scheduled instant at or before now, for a schedule string (NULL if none/invalid).
create function private.last_scheduled_instant(p_schedule text)
returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare
  dow int := split_part(p_schedule, ' ', 1)::int;
  hhmm time := split_part(p_schedule, ' ', 2)::time;
  tz text := split_part(p_schedule, ' ', 3);
  local_now timestamp;
  candidate timestamp;
begin
  if p_schedule is null then
    return null;
  end if;
  local_now := now() at time zone tz;
  candidate := date_trunc('day', local_now)
               - make_interval(days => ((extract(dow from local_now)::int - dow + 7) % 7))
               + hhmm;
  if candidate > local_now then
    candidate := candidate - interval '7 days';
  end if;
  return candidate at time zone tz;
exception when others then
  return null;
end;
$$;

-- Runs every minute (pg_cron): close rounds past their 24 h deadline, open scheduled rounds.
create function private.tick()
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

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------
create function public.start_checkin(p_project_id int)
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  active public.round_phase;
begin
  if not private.is_member(p_project_id) then
    raise exception 'Not a member of this project' using errcode = '42501';
  end if;
  select phase into active from public.rounds where project_id = p_project_id and phase <> 'locked';
  if active = 'placing' then
    raise exception 'A check-in is already open' using errcode = '55000';
  elsif active is not null then
    raise exception 'Lock the plan first' using errcode = '55000';
  end if;
  return private.open_round(p_project_id);
end;
$$;

create function public.seal(p_round_id int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me int := private.app_user_id();
  r  public.rounds;
  sealed_count int;
  member_count int;
begin
  select * into r from public.rounds where id = p_round_id for update;  -- serialises the last two sealers
  if r.id is null or not private.is_member(r.project_id) then
    raise exception 'Check-in not found' using errcode = '42501';
  end if;
  if r.phase <> 'placing' then
    raise exception 'This check-in is already closed' using errcode = '55000';
  end if;

  insert into public.seals (round_id, user_id) values (r.id, me);   -- sealing twice → unique_violation

  -- Every draft WITH hours joins the round; carried tasks without hours stay drafts.
  update public.stones set round_id = r.id
  where project_id = r.project_id and user_id = me and round_id is null and hours is not null;

  select count(*) into sealed_count from public.seals where round_id = r.id;
  select count(*) into member_count from public.members where project_id = r.project_id;
  if sealed_count >= member_count then
    perform private.reveal_round(r.id);
  end if;
end;
$$;

-- p_weekday NULL turns the schedule off.
create function public.set_checkin_schedule(p_project_id int, p_weekday int, p_time text, p_timezone text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_member(p_project_id) then
    raise exception 'Not a member of this project' using errcode = '42501';
  end if;
  if p_weekday is null then
    update public.projects set checkin_schedule = null, schedule_updated_at = now() where id = p_project_id;
    return;
  end if;
  if p_weekday not between 0 and 6 or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid schedule' using errcode = '22023';
  end if;
  update public.projects
  set checkin_schedule = format('%s %s %s', p_weekday, p_time, p_timezone), schedule_updated_at = now()
  where id = p_project_id;
end;
$$;

revoke execute on function private.open_round(int), private.reveal_round(int),
  private.last_scheduled_instant(text), private.tick() from public, anon, authenticated;
revoke execute on function public.start_checkin(int), public.seal(int),
  public.set_checkin_schedule(int, int, text, text) from public, anon;
grant execute on function public.start_checkin(int), public.seal(int),
  public.set_checkin_schedule(int, int, text, text) to authenticated;
