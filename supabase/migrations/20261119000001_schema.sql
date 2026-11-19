-- Weigh In — schema and keys (requirement 1).
-- Approved relations: users, projects, members, categories, stones, links, open_work.
-- Added: rounds, seals, agreements.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.users (
  id      serial primary key,
  auth_id uuid unique references auth.users (id) on delete set null,
  name    text check (name is null or length(btrim(name)) between 1 and 40),  -- asked after first sign-in
  email   text not null unique check (email = lower(email))
);

-- ---------------------------------------------------------------------------
-- Projects and membership
-- ---------------------------------------------------------------------------
create table public.projects (
  id               serial primary key,
  name             text not null check (length(btrim(name)) between 1 and 80),
  team_size        int not null default 0 check (team_size >= 0),   -- kept = COUNT(members) by trigger
  invite_code      char(8) not null unique check (invite_code ~ '^WGH-[0-9]{4}$'),
  password_hash    text not null,                                   -- pgcrypto crypt(), never plain text
  checkin_schedule text,                                            -- NULL = on demand only
  created_by       int not null references public.users (id),
  created_at       timestamptz not null default now()
);

create table public.members (
  project_id int not null references public.projects (id) on delete cascade,
  user_id    int not null references public.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)          -- joining twice is rejected here (requirement 3)
);

-- ---------------------------------------------------------------------------
-- Check-in rounds
-- ---------------------------------------------------------------------------
create type public.round_phase as enum ('placing', 'revealed', 'rebalancing', 'locked');

create table public.rounds (
  id          serial primary key,
  project_id  int not null references public.projects (id) on delete cascade,
  number      int not null check (number >= 1),
  phase       public.round_phase not null default 'placing',
  opens_at    timestamptz not null default now(),
  closes_at   timestamptz not null default now() + interval '24 hours',
  revealed_at timestamptz,
  locked_at   timestamptz,
  unique (project_id, number),
  unique (id, project_id),                   -- target for composite foreign keys below
  check (closes_at > opens_at)
);

-- Only one round per project that isn't locked yet (decided 11/19).
create unique index rounds_one_active_per_project
  on public.rounds (project_id) where phase <> 'locked';

create table public.seals (
  round_id  int not null references public.rounds (id) on delete cascade,
  user_id   int not null references public.users (id) on delete cascade,
  sealed_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Categories (pits)
-- ---------------------------------------------------------------------------
create table public.categories (
  id         serial primary key,
  project_id int not null references public.projects (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 40),
  colour     char(7) not null check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  created_by int references public.users (id) on delete set null,
  shared_at  timestamptz,                    -- NULL = private to its creator until the next reveal
  created_at timestamptz not null default now(),
  unique (id, project_id)
);

-- ---------------------------------------------------------------------------
-- Open work (rebalancing) — before stones, which can point back at it
-- ---------------------------------------------------------------------------
create table public.open_work (
  id          serial primary key,
  project_id  int not null references public.projects (id) on delete cascade,
  round_id    int not null,
  name        text not null check (length(btrim(name)) between 1 and 80),
  category_id int not null,
  hours       numeric(4, 1) not null check (hours > 0 and hours <= 99 and hours * 2 = trunc(hours * 2)),
  assigned_to int,                           -- NULL = unassigned
  created_by  int references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (round_id, project_id) references public.rounds (id, project_id) on delete cascade,
  foreign key (category_id, project_id) references public.categories (id, project_id),
  foreign key (project_id, assigned_to) references public.members (project_id, user_id) on delete set null (assigned_to)
);

-- ---------------------------------------------------------------------------
-- Stones
-- ---------------------------------------------------------------------------
create table public.stones (
  id           serial primary key,
  project_id   int not null,
  user_id      int not null,
  round_id     int,                          -- NULL = private draft; set when the owner seals
  category_id  int,                          -- NULL = Other work
  hours        numeric(4, 1)                 -- NULL only for a carried-over task not filled in yet
               check (hours is null or (hours > 0 and hours <= 24 and hours * 2 = trunc(hours * 2))),
  note         text check (note is null or length(note) <= 500),
  link         text check (link is null or link ~* '^https?://'),
  placed_on    timestamptz not null default now(),
  carried_from int references public.open_work (id) on delete set null,
  -- Requirement 1: a stone for someone who isn't a member of the project is rejected here.
  foreign key (project_id, user_id) references public.members (project_id, user_id) on delete cascade,
  foreign key (round_id, project_id) references public.rounds (id, project_id) on delete set null (round_id),
  foreign key (category_id, project_id) references public.categories (id, project_id) on delete set null (category_id),
  check (round_id is null or hours is not null)   -- sealed stones always have hours
);

create index stones_project_round on public.stones (project_id, round_id);
create index stones_user on public.stones (user_id);

-- ---------------------------------------------------------------------------
-- Agreements and links
-- ---------------------------------------------------------------------------
create table public.agreements (
  round_id  int not null references public.rounds (id) on delete cascade,
  user_id   int not null references public.users (id) on delete cascade,
  agreed_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

create table public.links (
  id         serial primary key,
  project_id int not null references public.projects (id) on delete cascade,
  label      text not null check (length(btrim(label)) between 1 and 60),
  url        text not null check (url ~* '^https?://')
);

-- ---------------------------------------------------------------------------
-- Requirement 2: per-member, per-category totals of sealed stones.
-- security_invoker = true so the view obeys the caller's row-level security and
-- can't leak stones that haven't been revealed.
-- ---------------------------------------------------------------------------
create view public.team_totals
with (security_invoker = true) as
select s.project_id,
       s.user_id,
       s.category_id,
       sum(s.hours) as hours
from public.stones s
where s.round_id is not null
group by s.project_id, s.user_id, s.category_id;
