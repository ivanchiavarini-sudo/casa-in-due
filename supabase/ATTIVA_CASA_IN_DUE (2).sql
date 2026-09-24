-- CASA IN DUE
-- Eseguire UNA SOLA VOLTA nel SQL Editor dello stesso progetto Supabase.
-- Non crea un secondo database: usa le tabelle già esistenti del Piccolo manuale.
-- La modifica importante è che Compiti, Spese e Mediatore possono essere usati SUBITO,
-- senza aspettare la conclusione del percorso.

-- COMPITI
drop policy if exists family_tasks_complete_read on public.family_tasks;
drop policy if exists family_tasks_complete_insert on public.family_tasks;
drop policy if exists family_tasks_complete_update on public.family_tasks;
drop policy if exists family_tasks_complete_delete on public.family_tasks;

create policy family_tasks_members_read
  on public.family_tasks for select to authenticated
  using(public.is_couple_member(couple_id));

create policy family_tasks_members_insert
  on public.family_tasks for insert to authenticated
  with check(created_by = auth.uid() and public.is_couple_member(couple_id));

create policy family_tasks_members_update
  on public.family_tasks for update to authenticated
  using(public.is_couple_member(couple_id))
  with check(public.is_couple_member(couple_id));

create policy family_tasks_members_delete
  on public.family_tasks for delete to authenticated
  using(public.is_couple_member(couple_id));

-- SPESE
drop policy if exists family_expenses_complete_read on public.family_expenses;
drop policy if exists family_expenses_complete_insert on public.family_expenses;
drop policy if exists family_expenses_complete_update on public.family_expenses;
drop policy if exists family_expenses_complete_delete on public.family_expenses;

create policy family_expenses_members_read
  on public.family_expenses for select to authenticated
  using(public.is_couple_member(couple_id));

create policy family_expenses_members_insert
  on public.family_expenses for insert to authenticated
  with check(created_by = auth.uid() and public.is_couple_member(couple_id));

create policy family_expenses_members_update
  on public.family_expenses for update to authenticated
  using(public.is_couple_member(couple_id))
  with check(public.is_couple_member(couple_id));

create policy family_expenses_members_delete
  on public.family_expenses for delete to authenticated
  using(public.is_couple_member(couple_id));

-- MEDIATORE / CONFRONTI
drop policy if exists maintenance_read_complete on public.maintenance_threads;
drop policy if exists maintenance_insert_complete on public.maintenance_threads;
drop policy if exists maintenance_update_complete on public.maintenance_threads;
drop policy if exists entries_read_complete on public.maintenance_entries;
drop policy if exists entries_insert_complete on public.maintenance_entries;

create policy maintenance_members_read
  on public.maintenance_threads for select to authenticated
  using(public.is_couple_member(couple_id));

create policy maintenance_members_insert
  on public.maintenance_threads for insert to authenticated
  with check(created_by = auth.uid() and public.is_couple_member(couple_id));

create policy maintenance_members_update
  on public.maintenance_threads for update to authenticated
  using(public.is_couple_member(couple_id))
  with check(public.is_couple_member(couple_id));

create policy entries_members_read
  on public.maintenance_entries for select to authenticated
  using(exists(
    select 1 from public.maintenance_threads t
    where t.id = thread_id and public.is_couple_member(t.couple_id)
  ));

create policy entries_members_insert
  on public.maintenance_entries for insert to authenticated
  with check(
    author_id = auth.uid()
    and exists(
      select 1 from public.maintenance_threads t
      where t.id = thread_id and public.is_couple_member(t.couple_id)
    )
  );

-- Mantiene invariati i permessi di colonna già previsti.
grant select, insert, delete on public.family_tasks to authenticated;
grant update(title, area, assignee_id, shared, frequency, due_date, status, notes, updated_at)
  on public.family_tasks to authenticated;

grant select, insert, delete on public.family_expenses to authenticated;
grant update(description, category, total_amount, paid_by_id, member_a_amount, member_b_amount, due_date, status, notes, updated_at)
  on public.family_expenses to authenticated;

grant select, insert on public.maintenance_entries to authenticated;
grant select, insert on public.maintenance_threads to authenticated;
grant update(title, status) on public.maintenance_threads to authenticated;
