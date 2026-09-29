create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_circle_members(p_circle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = p_circle_id and user_id = auth.uid() and can_manage_members = true
  );
$$;

create or replace function public.can_view_circle_health_data(p_circle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = p_circle_id and user_id = auth.uid() and can_view_health_data = true
  );
$$;

create or replace function public.can_manage_circle_medications(p_circle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = p_circle_id and user_id = auth.uid() and can_manage_medications = true
  );
$$;

-- care_circles
drop policy if exists "members can view their circles" on care_circles;
create policy "members can view their circles" on care_circles
  for select using ( is_circle_member(id) );

-- circle_members (the table that was actually recursing)
drop policy if exists "members can view circle membership" on circle_members;
create policy "members can view circle membership" on circle_members
  for select using ( is_circle_member(circle_id) );

drop policy if exists "members with permission can add members" on circle_members;
create policy "members with permission can add members" on circle_members
  for insert with check ( can_manage_circle_members(circle_id) );

drop policy if exists "members with permission can update members" on circle_members;
create policy "members with permission can update members" on circle_members
  for update using ( can_manage_circle_members(circle_id) );

drop policy if exists "members with permission can remove members" on circle_members;
create policy "members with permission can remove members" on circle_members
  for delete using ( can_manage_circle_members(circle_id) );

-- circle_invitations
drop policy if exists "members with permission can manage invitations" on circle_invitations;
create policy "members with permission can manage invitations" on circle_invitations
  for all using ( can_manage_circle_members(circle_id) );

-- prescriptions
drop policy if exists "view prescriptions" on prescriptions;
create policy "view prescriptions" on prescriptions
  for select using ( can_view_circle_health_data(circle_id) );

drop policy if exists "manage prescriptions" on prescriptions;
create policy "manage prescriptions" on prescriptions
  for insert with check ( can_manage_circle_medications(circle_id) );

drop policy if exists "update prescriptions" on prescriptions;
create policy "update prescriptions" on prescriptions
  for update using ( can_manage_circle_medications(circle_id) );

-- dose_logs (references prescriptions -> circle_id, so join stays, only
-- the circle_members check changes)
drop policy if exists "view dose logs" on dose_logs;
create policy "view dose logs" on dose_logs
  for select using (
    prescription_id in (
      select id from prescriptions where can_view_circle_health_data(circle_id)
    )
  );

drop policy if exists "log doses" on dose_logs;
create policy "log doses" on dose_logs
  for insert with check (
    prescription_id in (
      select id from prescriptions where can_manage_circle_medications(circle_id)
    )
  );

-- appointments
drop policy if exists "view appointments" on appointments;
create policy "view appointments" on appointments
  for select using ( can_view_circle_health_data(circle_id) );

drop policy if exists "manage appointments" on appointments;
create policy "manage appointments" on appointments
  for insert with check ( can_manage_circle_medications(circle_id) );

-- care_notes
drop policy if exists "circle members use notes" on care_notes;
create policy "circle members use notes" on care_notes
  for all using ( is_circle_member(circle_id) );