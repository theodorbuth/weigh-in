-- Weigh In — checks for requirements 1, 2, 3, 7, 9 (and team_size).
-- Run the whole file in the Supabase SQL editor (or psql as postgres).
-- Everything happens inside one transaction that is ROLLED BACK at the end,
-- so it leaves no data behind. Each check prints "PASS …" or stops with an error.

begin;

-- Helper: act as a signed-in user (what the browser does with its JWT).
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

-- Three people sign in for the first time (requirement 7 trigger creates users rows).
-- Mei already has a users row (seeded by email) — sign-in must LINK it, not duplicate it.
insert into public.users (email, name) values ('mei.check@example.com', 'Mei');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Ana.Check@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ben.check@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'mei.check@example.com');

do $$
declare n int; mei_auth uuid;
begin
  select count(*) into n from public.users where email in ('ana.check@example.com', 'ben.check@example.com', 'mei.check@example.com');
  select auth_id into mei_auth from public.users where email = 'mei.check@example.com';
  assert n = 3, 'expected exactly 3 users rows, got ' || n;
  assert mei_auth = '00000000-0000-0000-0000-00000000000c', 'Mei''s seeded row was not linked to her sign-in';
  raise notice 'PASS req 7: sign-in finds/creates the users row by email (seeded row linked, email lower-cased)';
end $$;

-- Ana creates a project.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a'); end $$;
create temp table t_project on commit drop as
  select * from public.create_project('Check project', 'secret42',
    '[{"name":"Research","colour":"#5FB3A8"},{"name":"Slides","colour":"#E8B65A"}]'::jsonb, 'WGH-0001');
do $$ begin perform pg_temp.act_as_admin(); end $$;
grant select on t_project to authenticated;

do $$
declare pid int; ts int; code text;
begin
  select project_id, invite_code into pid, code from t_project;
  select team_size into ts from public.projects where id = pid;
  assert ts = 1, 'team_size should be 1 after creating, got ' || ts;
  raise notice 'PASS create_project: project % (%), creator is a member, team_size = 1', pid, code;
end $$;

-- Requirement 3: join with wrong password inserts nothing; right password joins; twice is rejected by the PK.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b'); end $$;
do $$
declare code text; before_n int; after_n int;
begin
  select invite_code into code from t_project;
  select count(*) into before_n from public.members;   -- Ben sees only his own projects (none)
  begin
    perform public.join_project(code, 'wrong-password');
    raise exception 'join with wrong password should have failed';
  exception when sqlstate '28P01' then null;
  end;
  select count(*) into after_n from public.members;
  assert before_n = after_n, 'wrong password inserted a member row';

  perform public.join_project(lower(code), 'secret42');

  begin
    perform public.join_project(code, 'secret42');
    raise exception 'joining twice should have failed';
  exception when unique_violation then null;          -- 23505 from members' primary key
  end;
  raise notice 'PASS req 3: wrong password inserts nothing; join works; joining twice -> unique_violation (PK)';
end $$;
do $$ begin perform pg_temp.act_as_admin(); end $$;

do $$
declare ts int;
begin
  select team_size into ts from public.projects where id = (select project_id from t_project);
  assert ts = 2, 'team_size should be 2 after Ben joined, got ' || ts;
  raise notice 'PASS team_size follows members (now 2)';
end $$;

-- Requirement 1: a stone for someone who isn't a member is rejected by the foreign key.
do $$
declare pid int; mei int;
begin
  select project_id into pid from t_project;
  select id into mei from public.users where email = 'mei.check@example.com';
  begin
    insert into public.stones (project_id, user_id, hours) values (pid, mei, 1);
    raise exception 'stone for a non-member should have been rejected';
  exception when foreign_key_violation then null;    -- 23503 from (project_id, user_id) -> members
  end;
  raise notice 'PASS req 1: stone for a non-member -> foreign_key_violation';
end $$;

-- Ana and Ben place draft stones.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a'); end $$;
insert into public.stones (project_id, user_id, category_id, hours, note)
select p.project_id, private.app_user_id(), c.id, 2, 'Lit review'
from t_project p join public.categories c on c.project_id = p.project_id and c.name = 'Research';
insert into public.stones (project_id, user_id, category_id, hours, note)
select p.project_id, private.app_user_id(), c.id, 1.5, 'Deck'
from t_project p join public.categories c on c.project_id = p.project_id and c.name = 'Slides';

do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b'); end $$;
insert into public.stones (project_id, user_id, category_id, hours)
select p.project_id, private.app_user_id(), c.id, 3
from t_project p join public.categories c on c.project_id = p.project_id and c.name = 'Research';
do $$ begin perform pg_temp.act_as_admin(); end $$;

-- Simulate a round where both sealed (seal() comes in a later migration).
insert into public.rounds (project_id, number) select project_id, 1 from t_project;
update public.stones set round_id = (select id from public.rounds where project_id = (select project_id from t_project))
where project_id = (select project_id from t_project);
insert into public.seals (round_id, user_id)
select r.id, u.id from public.rounds r, public.users u
where r.project_id = (select project_id from t_project) and u.email in ('ana.check@example.com', 'ben.check@example.com');

-- Requirement 9: while placing, Ben can't read Ana's stones — not from the table, not from the view.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b'); end $$;
do $$
declare n int; t int;
begin
  select count(*) into n from public.stones where user_id <> private.app_user_id();
  select count(*) into t from public.team_totals where user_id <> private.app_user_id();
  assert n = 0, 'LEAK: Ben can read ' || n || ' of Ana''s stones before the reveal';
  assert t = 0, 'LEAK: team_totals shows Ana''s totals before the reveal';
  begin
    perform password_hash from public.projects;
    raise exception 'LEAK: password_hash is readable';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS req 9: before reveal Ben sees none of Ana''s stones (table + team_totals); password_hash hidden';
end $$;

-- Sealed stones can't be edited.
do $$
declare n int;
begin
  update public.stones set hours = 24 where user_id = private.app_user_id();
  get diagnostics n = row_count;
  assert n = 0, 'sealed stones were editable';
  raise notice 'PASS sealing is final: sealed stones can''t be edited';
end $$;
do $$ begin perform pg_temp.act_as_admin(); end $$;

-- Reveal.
update public.rounds set phase = 'revealed', revealed_at = now() where project_id = (select project_id from t_project);

-- Requirement 2: after the reveal, team_totals = SUM(hours) per member and category.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b'); end $$;
do $$
declare n int; ana_research numeric; ana_slides numeric; ben_research numeric;
begin
  select count(*) into n from public.stones where user_id <> private.app_user_id();
  assert n = 2, 'after reveal Ben should see Ana''s 2 stones, saw ' || n;
  select t.hours into ana_research from public.team_totals t join public.categories c on c.id = t.category_id
    join public.users u on u.id = t.user_id where u.email = 'ana.check@example.com' and c.name = 'Research';
  select t.hours into ana_slides from public.team_totals t join public.categories c on c.id = t.category_id
    join public.users u on u.id = t.user_id where u.email = 'ana.check@example.com' and c.name = 'Slides';
  select t.hours into ben_research from public.team_totals t join public.categories c on c.id = t.category_id
    where t.user_id = private.app_user_id() and c.name = 'Research';
  assert ana_research = 2 and ana_slides = 1.5 and ben_research = 3,
    format('team_totals wrong: ana research %s, ana slides %s, ben research %s', ana_research, ana_slides, ben_research);
  raise notice 'PASS req 2: after reveal team_totals = Ana Research 2, Ana Slides 1.5, Ben Research 3';
end $$;

-- Mei (signed in, not a member) sees nothing of the project.
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000c'); end $$;
do $$
declare n int;
begin
  select (select count(*) from public.projects) + (select count(*) from public.stones)
       + (select count(*) from public.members) + (select count(*) from public.team_totals) into n;
  assert n = 0, 'a non-member can see ' || n || ' rows of the project';
  raise notice 'PASS non-members see nothing';
end $$;
do $$ begin perform pg_temp.act_as_admin(); end $$;

rollback;
