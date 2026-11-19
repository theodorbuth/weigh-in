-- Weigh In — run private.tick() every minute with Supabase Cron (pg_cron):
-- reveals rounds at their 24 h deadline and opens scheduled check-ins, even when
-- nobody has the app open. (Not part of the local plain-Postgres test run.)
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('weigh-in-tick', '* * * * *', 'select private.tick()');
