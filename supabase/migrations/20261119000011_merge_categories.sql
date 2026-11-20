-- Weigh In — merge one category into another (decided 11/19): every stone (all rounds, all members)
-- and every open-work task moves into the target; the merged category is deleted. Nothing is lost.

-- Let the open-work triggers stand aside while a merge relabels tasks (even in locked plans, and
-- without clearing agreements — a merge doesn't change who does what or how long it takes).
create or replace function private.open_work_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  w public.open_work := coalesce(new, old);
  ph public.round_phase;
begin
  if current_setting('weighin.merging', true) = 'on' then
    return coalesce(new, old);
  end if;
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

create or replace function private.open_work_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rid int := coalesce(new.round_id, old.round_id);
begin
  if current_setting('weighin.merging', true) = 'on' then
    return null;
  end if;
  update public.rounds set phase = 'rebalancing' where id = rid and phase = 'revealed';
  delete from public.agreements where round_id = rid;
  return null;
end;
$$;

create function public.merge_categories(p_from int, p_into int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me int := private.app_user_id();
  src public.categories;
  dst public.categories;
begin
  select * into src from public.categories where id = p_from;
  select * into dst from public.categories where id = p_into;
  if src.id is null or dst.id is null or src.project_id <> dst.project_id or src.id = dst.id
     or not private.is_member(src.project_id) then
    raise exception 'Category not found' using errcode = '42501';
  end if;
  -- You may merge a shared category, or your own private one …
  if src.shared_at is null and src.created_by is distinct from me then
    raise exception 'Category not found' using errcode = '42501';
  end if;
  -- … into a shared category, or into another private category of your own.
  if dst.shared_at is null and (dst.created_by is distinct from me or src.shared_at is not null) then
    raise exception 'Merge into a shared category' using errcode = '42501';
  end if;

  perform set_config('weighin.merging', 'on', true);
  update public.stones set category_id = dst.id where category_id = src.id;
  update public.open_work set category_id = dst.id where category_id = src.id;
  perform set_config('weighin.merging', 'off', true);

  delete from public.categories where id = src.id;
end;
$$;

revoke execute on function public.merge_categories(int, int) from public, anon;
grant execute on function public.merge_categories(int, int) to authenticated;
