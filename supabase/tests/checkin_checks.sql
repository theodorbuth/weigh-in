-- Weigh In — checks for the check-in cycle (requirements 9 + 10, schedule).
-- Run the whole file in the Supabase SQL editor (or psql as postgres). It ROLLS BACK.

begin;

create function pg_temp.act_as(p_auth uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_auth, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.act_as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana.cycle@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'ben.cycle@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'cai.cycle@example.com');
update public.users set name = initcap(split_part(email, '.', 1)) where email like '%.cycle@example.com';

-- Ana creates the project; Ben and Cai join.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1'); end $$;
create temp table t_p on commit drop as
  select * from public.create_project('Cycle', 'pw-cycle', '[{"name":"Research","colour":"#5FB3A8"}]'::jsonb);
do $$ begin perform pg_temp.act_as_admin(); end $$;
grant select on t_p to authenticated;
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1'); perform public.join_project((select invite_code from t_p), 'pw-cycle'); end $$;
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c1'); perform public.join_project((select invite_code from t_p), 'pw-cycle'); end $$;

-- Everyone places draft stones before any check-in exists (drafts are allowed any time).
-- Ben also makes a PRIVATE category "  research " (same name as the shared one, different spacing/case).
do $$
declare pid int := (select project_id from t_p); rc int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  rc := (select id from public.categories where project_id = pid and name = 'Research');
  insert into public.stones (project_id, user_id, category_id, hours) values (pid, private.app_user_id(), rc, 2);
  insert into public.stones (project_id, user_id, category_id, hours, note) values (pid, private.app_user_id(), rc, null, 'Carried task, no hours yet');

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
  insert into public.categories (project_id, name, colour, created_by) values (pid, '  research ', '#9C8BC9', private.app_user_id());
  insert into public.stones (project_id, user_id, category_id, hours)
  values (pid, private.app_user_id(), (select id from public.categories where project_id = pid and created_by = private.app_user_id()), 3);

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
  insert into public.stones (project_id, user_id, hours) values (pid, private.app_user_id(), 1);
  perform pg_temp.act_as_admin();
end $$;

-- Ana can't see Ben's private category.
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  select count(*) into n from public.categories where project_id = (select project_id from t_p);
  assert n = 1, 'Ana should only see the shared category before the reveal, saw ' || n;
  perform pg_temp.act_as_admin();
  raise notice 'PASS private category hidden from teammates before the reveal';
end $$;

-- Ana starts a check-in; a second start is rejected.
do $$
declare rid int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  rid := public.start_checkin((select project_id from t_p));
  begin
    perform public.start_checkin((select project_id from t_p));
    raise exception 'a second check-in should be rejected';
  exception when sqlstate '55000' then null;
  end;
  perform pg_temp.act_as_admin();
  raise notice 'PASS start_checkin opens round %; a second one is rejected while it is open', rid;
end $$;

-- Ana and Ben seal; still placing (Cai hasn't). Ana's hour-less task stays a draft. Sealing twice fails.
do $$
declare rid int := (select id from public.rounds where project_id = (select project_id from t_p));
        ph public.round_phase; drafts int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  perform public.seal(rid);
  select count(*) into drafts from public.stones where user_id = private.app_user_id() and round_id is null;
  assert drafts = 1, 'Ana''s hour-less carried task should stay a draft';
  begin
    perform public.seal(rid);
    raise exception 'sealing twice should fail';
  exception when unique_violation then null;
  end;
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
  perform public.seal(rid);
  perform pg_temp.act_as_admin();
  select phase into ph from public.rounds where id = rid;
  assert ph = 'placing', 'should still be placing until everyone seals, got ' || ph;
  raise notice 'PASS seal: hour-less tasks stay drafts, sealing twice fails, round waits for everyone';
end $$;

-- Requirement 9 during the wait: Ben (sealed) still can't read Ana's sealed stones.
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
  select count(*) into n from public.stones where user_id <> private.app_user_id();
  assert n = 0, 'LEAK: Ben sees ' || n || ' teammate stones before the reveal';
  perform pg_temp.act_as_admin();
  raise notice 'PASS req 9: nothing leaks while waiting for the last seal';
end $$;

-- Cai seals last → instant reveal. Ben's private "  research " merges into the shared Research.
do $$
declare rid int := (select id from public.rounds where project_id = (select project_id from t_p));
        ph public.round_phase; cats int; ben_in_shared int; visible int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
  perform public.seal(rid);
  select count(*) into visible from public.stones where round_id = rid;
  perform pg_temp.act_as_admin();
  select phase into ph from public.rounds where id = rid;
  select count(*) into cats from public.categories where project_id = (select project_id from t_p);
  select count(*) into ben_in_shared from public.stones s join public.categories c on c.id = s.category_id
    join public.users u on u.id = s.user_id where u.email = 'ben.cycle@example.com' and c.name = 'Research';
  assert ph = 'revealed', 'last seal should reveal, got ' || ph;
  assert cats = 1, 'duplicate category should have merged, categories = ' || cats;
  assert ben_in_shared = 1, 'Ben''s stone should now be in the shared Research category';
  assert visible = 3, 'after the reveal Cai should see all 3 sealed stones, saw ' || visible;
  raise notice 'PASS req 10: last seal reveals; private same-name category merged; everyone sees sealed stones';
end $$;

-- After the reveal, a new check-in is blocked until the plan is locked.
do $$
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
  begin
    perform public.start_checkin((select project_id from t_p));
    raise exception 'starting during rebalancing should fail';
  exception when sqlstate '55000' then null;
  end;
  perform pg_temp.act_as_admin();
  raise notice 'PASS no new check-in until the plan is locked';
end $$;

-- Deadline: lock round 1, open round 2, only Ana seals, the 24 h pass → tick() reveals without the others.
do $$
declare pid int := (select project_id from t_p); rid int; ph public.round_phase; cai_drafts int;
begin
  update public.rounds set phase = 'locked', locked_at = now() where project_id = pid;
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
  insert into public.stones (project_id, user_id, hours) values (pid, private.app_user_id(), 2);
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  rid := public.start_checkin(pid);
  insert into public.stones (project_id, user_id, hours) values (pid, private.app_user_id(), 1);
  perform public.seal(rid);
  perform pg_temp.act_as_admin();
  update public.rounds set opens_at = now() - interval '25 hours', closes_at = now() - interval '1 hour' where id = rid;
  perform private.tick();
  select phase into ph from public.rounds where id = rid;
  select count(*) into cai_drafts from public.stones s join public.users u on u.id = s.user_id
    where u.email = 'cai.cycle@example.com' and s.round_id is null;
  assert ph = 'revealed', 'deadline should reveal, got ' || ph;
  assert cai_drafts = 1, 'Cai''s unsealed stone should stay a draft for next round';
  raise notice 'PASS deadline: tick() reveals with sealed stones only; unsealed stones roll over as drafts';
end $$;

-- Schedule: setting it never starts a round immediately; a due time after the change does.
do $$
declare pid int := (select project_id from t_p); n_before int; n_after int; dow int;
begin
  update public.rounds set phase = 'locked', locked_at = now() where project_id = pid;
  dow := extract(dow from (now() at time zone 'America/New_York'))::int;
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
  perform public.set_checkin_schedule(pid, dow, '00:00', 'America/New_York');   -- today 00:00 already passed
  perform pg_temp.act_as_admin();
  select count(*) into n_before from public.rounds where project_id = pid;
  perform private.tick();
  select count(*) into n_after from public.rounds where project_id = pid;
  assert n_after = n_before, 'setting a schedule must not open a round for a time before it was set';
  -- Pretend the schedule (and the earlier rounds) date from last week.
  update public.projects set schedule_updated_at = now() - interval '8 days' where id = pid;
  update public.rounds set opens_at = opens_at - interval '9 days', closes_at = closes_at - interval '9 days' where project_id = pid;
  perform private.tick();
  select count(*) into n_after from public.rounds where project_id = pid;
  assert n_after = n_before + 1, 'a scheduled time after the schedule was set should open a round';
  perform private.tick();
  assert (select count(*) from public.rounds where project_id = pid) = n_after, 'tick must not open the same week twice';
  raise notice 'PASS schedule: no instant start on change; due time opens exactly one round';
end $$;

rollback;
