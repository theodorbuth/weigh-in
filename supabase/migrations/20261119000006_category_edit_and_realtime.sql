-- Weigh In — any member may rename/recolour a SHARED category (decided 11/19); private
-- categories stay editable only by their creator. Only name and colour can change.
drop policy "categories: edit own private" on public.categories;

create policy "categories: edit shared or own private" on public.categories
  for update to authenticated
  using (
    private.is_member(project_id)
    and (shared_at is not null or created_by = private.app_user_id())
  )
  with check (
    private.is_member(project_id)
    and (shared_at is not null or created_by = private.app_user_id())
  );

revoke update on public.categories from authenticated;
grant update (name, colour) on public.categories to authenticated;

-- Realtime: changes to these tables are pushed to open browsers (row-level security
-- still decides who receives which rows, so private stones stay private).
alter publication supabase_realtime add table
  public.stones, public.categories, public.rounds, public.seals,
  public.members, public.open_work, public.agreements;
