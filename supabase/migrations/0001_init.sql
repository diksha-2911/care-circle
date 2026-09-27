-- Care Circle: initial schema
--
-- Authentication vs. authorization:
--   - Authentication (who you are) is handled entirely by Supabase Auth
--     (the `users` table just mirrors `auth.users` with profile fields).
--   - Authorization (what you can do, and in which family group) lives in
--     `circle_members` — a single user can belong to multiple care_circles
--     with a different role/permission set in each.

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text,
  created_at timestamptz not null default now()
);

-- A "care_circle" is the shared family group around one patient.
create table care_circles (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create type member_role as enum ('patient', 'caregiver');

-- circle_members is the authorization table: role + permissions, s
-- Only two roles exist — `patient` and `caregiver` — 
-- SOS-triggering is restricted to the patient: a caregiver row can never
-- have can_trigger_sos = true (enforced below via a check constraint,
-- not just a default, so it can't be toggled on by mistake).
create table circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role member_role not null,

  can_manage_medications boolean not null default false,  -- log/edit own doses, prescriptions
  can_view_health_data boolean not null default true,     -- medications, adherence, appointments
  can_manage_members boolean not null default true,       -- invite/remove family members
  can_trigger_sos boolean not null default false,
  receives_sos_alerts boolean not null default true,

  created_at timestamptz not null default now(),
  unique (circle_id, user_id),
  constraint caregiver_cannot_trigger_sos check (
    not (role = 'caregiver' and can_trigger_sos = true)
  )
);

-- Invitations: the patient (or an admin) generates a short code/link;
-- an invited family member redeems it to join with a pre-set role.
create table circle_invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles(id) on delete cascade,
  invited_by_user_id uuid not null references users(id),
  code text not null unique,                 -- short shareable code
  role member_role not null default 'caregiver',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles(id) on delete cascade,
  drug_name text not null,
  dosage text not null,             -- e.g. "10mg"
  frequency_per_day int not null,   -- e.g. 2
  alarm_times time[] not null,      -- personalized alarm times, e.g. {08:00, 20:00}
  quantity_remaining int not null,
  refill_threshold int not null default 5,
  created_at timestamptz not null default now()
);

create table dose_logs (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  logged_by_user_id uuid references users(id),
  scheduled_time timestamptz not null,
  taken_at timestamptz,             -- null until logged as taken
  status text not null default 'pending' check (status in ('pending', 'taken', 'missed')),
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles(id) on delete cascade,
  doctor_name text,
  appointment_time timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table care_notes (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles(id) on delete cascade,
  author_user_id uuid references users(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security everywhere.
alter table care_circles enable row level security;
alter table circle_members enable row level security;
alter table circle_invitations enable row level security;
alter table prescriptions enable row level security;
alter table dose_logs enable row level security;
alter table appointments enable row level security;
alter table care_notes enable row level security;


-- care_circles: members can see the circles they belong to.
create policy "members can view their circles" on care_circles
  for select using (
    id in (select circle_id from circle_members where user_id = auth.uid())
  );

-- circle_members: members can see who else is in their circle;
create policy "members can view circle membership" on circle_members
  for select using (
    circle_id in (select circle_id from circle_members where user_id = auth.uid())
  );

create policy "members with permission can add members" on circle_members
  for insert with check (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_members = true
    )
  );

create policy "members with permission can update members" on circle_members
  for update using (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_members = true
    )
  );

create policy "members with permission can remove members" on circle_members
  for delete using (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_members = true
    )
  );

-- circle_invitations: creating/viewing invitations requires
-- can_manage_members = true (same permission as managing members)
create policy "members with permission can manage invitations" on circle_invitations
  for all using (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_members = true
    )
  );

-- prescriptions: any member with can_view_health_data can read;
-- only members with can_manage_medications can write.
create policy "view prescriptions" on prescriptions
  for select using (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_view_health_data = true
    )
  );

create policy "manage prescriptions" on prescriptions
  for insert with check (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_medications = true
    )
  );

create policy "update prescriptions" on prescriptions
  for update using (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_medications = true
    )
  );

-- dose_logs: readable by anyone with can_view_health_data on the parent
-- prescription's circle; writable by anyone with can_manage_medications.
create policy "view dose logs" on dose_logs
  for select using (
    prescription_id in (
      select p.id from prescriptions p
      join circle_members cm on cm.circle_id = p.circle_id
      where cm.user_id = auth.uid() and cm.can_view_health_data = true
    )
  );

create policy "log doses" on dose_logs
  for insert with check (
    prescription_id in (
      select p.id from prescriptions p
      join circle_members cm on cm.circle_id = p.circle_id
      where cm.user_id = auth.uid() and cm.can_manage_medications = true
    )
  );

-- appointments: same view/manage split as prescriptions.
create policy "view appointments" on appointments
  for select using (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_view_health_data = true
    )
  );

create policy "manage appointments" on appointments
  for insert with check (
    circle_id in (
      select circle_id from circle_members
      where user_id = auth.uid() and can_manage_medications = true
    )
  );

-- care_notes: any circle member can read or post a note — this is a
-- communication feature, not gated by health-data permissions.
create policy "circle members use notes" on care_notes
  for all using (
    circle_id in (select circle_id from circle_members where user_id = auth.uid())
  );