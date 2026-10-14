-- Appointment management fields and write permissions.
-- Existing appointments remain valid; reminders are optional for old rows.
alter table public.appointments
  add column if not exists location text,
  add column if not exists reminder_ids text[] not null default '{}';

-- The original schema grants INSERT but not UPDATE/DELETE. Keep writes
-- restricted to circle members with medication-management permission.
create policy "update appointments" on public.appointments
  for update using (
    circle_id in (
      select circle_id from public.circle_members
      where user_id = auth.uid() and can_manage_medications = true
    )
  ) with check (
    circle_id in (
      select circle_id from public.circle_members
      where user_id = auth.uid() and can_manage_medications = true
    )
  );

create policy "delete appointments" on public.appointments
  for delete using (
    circle_id in (
      select circle_id from public.circle_members
      where user_id = auth.uid() and can_manage_medications = true
    )
  );
