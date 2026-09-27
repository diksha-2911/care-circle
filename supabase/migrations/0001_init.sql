-- Care Circle: initial schema

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text,
  created_at timestamptz not null default now()
);

create table care_circles (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create type member_role as enum ('parent', 'child', 'sibling');

create table circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references care_circles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role member_role not null,
  can_log_doses boolean not null default true,
  receives_sos_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  unique (circle_id, user_id)
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

-- Enable Row Level Security (tighten policies before any real deployment)
alter table care_circles enable row level security;
alter table circle_members enable row level security;
alter table prescriptions enable row level security;
alter table dose_logs enable row level security;
alter table appointments enable row level security;
alter table care_notes enable row level security;

-- Minimal demo policy: circle members can read/write their own circle's data.
-- NOTE: tighten this (e.g. split read vs. write, restrict by can_log_doses)
-- before using with real data.
create policy "circle members access" on prescriptions
  for all using (
    circle_id in (select circle_id from circle_members where user_id = auth.uid())
  );
