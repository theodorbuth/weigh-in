-- Weigh In — checks for rebalancing (requirement 12). Run as postgres; it ROLLS BACK.

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
  ('00000000-0000-0000-0000-0000000000a2', 'ana.rebal@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'ben.rebal@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'cai.rebal@example.com');

do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2'); end $$;
create temp table t_p on commit drop as
  select * from public.create_project('Rebal', 'pw-rebal', '[{"name":"Research","colour":"#5FB3A8"},{"name":"Slides","colour":"#E8B65A"}]'::jsonb);
do $$ begin perform pg_temp.act_as_admin(); end $$;
grant select on t_p to authenticated;
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2'); perform public.join_project((select invite_code from t_p), 'pw-rebal'); end $$;
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c2'); perform public.join_project((select invite_code from t_p), 'pw-rebal'); end $$;

-- Open work can't be added before a reveal.
do $$
declare pid int := (select project_id from t_p); rid int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  rid := public.start_checkin(pid);
  begin
    insert into public.open_work (project_id, round_id, name, category_id, hours)
    values (pid, rid, 'Too early', (select id from public.categories where project_id = pid and name = 'Research'), 2);
    raise exception 'open work during placing should be rejected';
  exception when sqlstate '55000' then null;
  end;
  -- Ana and Ben seal; Cai never does → deadline reveal.
  insert into public.stones (project_id, user_id, hours) values (pid, private.app_user_id(), 4);
  perform public.seal(rid);
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  insert into public.stones (project_id, user_id, hours) values (pid, private.app_user_id(), 2);
  perform public.seal(rid);
  perform pg_temp.act_as_admin();
  update public.rounds set closes_at = now() - interval '1 minute', opens_at = now() - interval '1 day' where id = rid;
  perform private.tick();
  assert (select phase from public.rounds where id = rid) = 'revealed', 'deadline should reveal';
  assert (select rebalance_closes_at from public.rounds where id = rid) > now(), 'reveal should set a 24 h rebalance window';
  raise notice 'PASS no open work before the reveal; reveal opens a 24 h rebalancing window';
end $$;

-- Add work, assign, agree; a change clears agreements; Cai (not submitted) can't be assigned.
do $$
declare pid int := (select project_id from t_p);
        rid int := (select id from public.rounds where project_id = (select project_id from t_p));
        w1 int; w2 int; ben int; cai int; n int;
begin
  select id into ben from public.users where email = 'ben.rebal@example.com';
  select id into cai from public.users where email = 'cai.rebal@example.com';
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  insert into public.open_work (project_id, round_id, name, category_id, hours)
  values (pid, rid, 'Final video', (select id from public.categories where project_id = pid and name = 'Slides'), 4)
  returning id into w1;
  insert into public.open_work (project_id, round_id, name, category_id, hours)
  values (pid, rid, 'Synopsis', (select id from public.categories where project_id = pid and name = 'Research'), 3)
  returning id into w2;
  assert (select phase from public.rounds where id = rid) = 'rebalancing', 'adding work should start rebalancing';

  begin
    update public.open_work set assigned_to = cai where id = w1;
    raise exception 'a not-submitted member should not be assignable';
  exception when sqlstate '23514' then null;
  end;

  begin
    perform public.agree(rid);
    raise exception 'agreeing with unassigned work should fail';
  exception when sqlstate '55000' then null;
  end;

  update public.open_work set assigned_to = ben where id = w1;
  update public.open_work set assigned_to = private.app_user_id() where id = w2;
  perform public.agree(rid);
  select count(*) into n from public.agreements where round_id = rid;
  assert n = 1, 'Ana''s agreement should be recorded';

  -- Cai didn't seal → can't agree.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
  begin
    perform public.agree(rid);
    raise exception 'a not-submitted member should not be able to agree';
  exception when sqlstate '42501' then null;
  end;

  -- Ben changes the plan → Ana's agreement is cleared.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  update public.open_work set hours = 5 where id = w1;
  select count(*) into n from public.agreements where round_id = rid;
  assert n = 0, 'a plan change must clear all agreements, still ' || n;
  perform pg_temp.act_as_admin();
  raise notice 'PASS assign/agree rules: not-submitted excluded, unassigned blocks agreement, any change clears agreements';
end $$;

-- Ana + Ben agree → locks; carry-over stones appear as drafts without hours; open work is then frozen.
do $$
declare pid int := (select project_id from t_p);
        rid int := (select id from public.rounds where project_id = (select project_id from t_p));
        carried int; ph public.round_phase;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  perform public.agree(rid);
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  perform public.agree(rid);
  select count(*) into carried from public.stones
    where user_id = private.app_user_id() and round_id is null and hours is null and note = 'Final video';
  begin
    update public.open_work set hours = 1 where round_id = rid;
    raise exception 'open work must be frozen after the lock';
  exception when sqlstate '55000' then null;
  end;
  perform pg_temp.act_as_admin();
  select phase into ph from public.rounds where id = rid;
  assert ph = 'locked', 'last sealed member agreeing should lock, got ' || ph;
  assert carried = 1, 'Ben should get "Final video" as a draft without hours';
  raise notice 'PASS req 12: last agreement locks the plan; assigned work carries over as hour-less drafts';
end $$;

-- 24 h timeout locks a fully assigned plan; a shared category can be created while rebalancing.
do $$
declare pid int := (select project_id from t_p); rid int; cat int;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  rid := public.start_checkin(pid);
  perform public.seal(rid);
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  perform public.seal(rid);
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
  perform public.seal(rid);  -- everyone sealed → revealed
  insert into public.categories (project_id, name, colour, created_by, shared_at)
  values (pid, 'Demo', '#9C8BC9', private.app_user_id(), now()) returning id into cat;
  insert into public.open_work (project_id, round_id, name, category_id, hours, assigned_to)
  values (pid, rid, 'Demo prep', cat, 2, private.app_user_id());
  perform pg_temp.act_as_admin();
  update public.rounds set rebalance_closes_at = now() - interval '1 minute' where id = rid;
  perform private.tick();
  assert (select phase from public.rounds where id = rid) = 'locked', 'rebalance timeout should lock an assigned plan';
  raise notice 'PASS shared category during rebalancing; 24 h timeout locks the plan';
end $$;

-- Merging categories: everything moves (sealed stones, locked-plan tasks), nothing is lost.
do $$
declare pid int := (select project_id from t_p);
        slides int := (select id from public.categories where project_id = (select project_id from t_p) and name = 'Slides');
        research int := (select id from public.categories where project_id = (select project_id from t_p) and name = 'Research');
        stones_before int; work_before int; agreements_before int; ben_private int; n int;
begin
  select count(*) into stones_before from public.stones where category_id in (slides, research);
  select count(*) into work_before from public.open_work where category_id in (slides, research);
  select count(*) into agreements_before from public.agreements;
  -- Put a stone in Slides so there's something to move.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  insert into public.stones (project_id, user_id, category_id, hours) values (pid, private.app_user_id(), slides, 1);
  insert into public.categories (project_id, name, colour, created_by) values (pid, 'Vid', '#9C8BC9', private.app_user_id())
  returning id into ben_private;
  -- Ana can't merge Ben's private category (she can't even see it).
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  begin
    perform public.merge_categories(ben_private, research);
    raise exception 'merging someone else''s private category should fail';
  exception when sqlstate '42501' then null;
  end;
  -- Ben merges the shared Slides into Research, and his own private Vid into Research.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  perform public.merge_categories(slides, research);
  perform public.merge_categories(ben_private, research);
  perform pg_temp.act_as_admin();
  assert not exists (select 1 from public.categories where id in (slides, ben_private)), 'merged categories should be gone';
  select count(*) into n from public.stones where category_id = research;
  assert n = stones_before + 1, format('all stones should now be in Research: %s vs %s', n, stones_before + 1);
  select count(*) into n from public.open_work where category_id = research;
  assert n = work_before, 'tasks (incl. locked plans) should move to Research';
  assert (select count(*) from public.agreements) = agreements_before, 'a merge must not clear agreements';
  raise notice 'PASS merge: sealed stones and locked-plan tasks move, agreements kept, private ones protected';
end $$;

-- Deleting a project with locked open work still works (cascade).
do $$
begin
  delete from public.projects where id = (select project_id from t_p);
  raise notice 'PASS deleting a project with locked rounds cascades cleanly';
end $$;

rollback;
