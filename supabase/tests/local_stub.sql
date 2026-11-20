-- Local test harness: minimal stand-ins for what Supabase provides (auth schema, roles, default grants,
-- realtime publication) so migrations + tests/*.sql can run on a plain postgres:17 Docker container.
-- Not a migration. Usage is documented in CLAUDE.md ("How to test").
-- Minimal stand-in for what Supabase provides, so migrations can be tested on plain Postgres.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;
create schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase default privileges ("grant API access to new tables automatically")
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create publication supabase_realtime;
