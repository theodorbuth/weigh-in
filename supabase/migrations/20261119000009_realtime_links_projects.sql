-- Weigh In — also push live changes to team links and project settings (e.g. the weekly schedule).
alter publication supabase_realtime add table public.links, public.projects;
