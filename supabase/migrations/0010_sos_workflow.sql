-- SOS workflow tables. Apply only after confirming equivalent tables do not already exist.
create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  triggered_by_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing','sent','partially_sent','delivery_failed','delivery_error','no_recipients','acknowledged','resolved')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text,
  unique (triggered_by_user_id, idempotency_key)
);
create index if not exists sos_events_circle_created_idx on public.sos_events(circle_id, created_at desc);

create table if not exists public.sos_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sos_events(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('push','sms')),
  status text not null check (status in ('processing','sent','failed')),
  attempt_count integer not null default 1,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists sos_deliveries_event_idx on public.sos_deliveries(event_id);

create table if not exists public.sos_acknowledgements (
  event_id uuid not null references public.sos_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  note text,
  primary key (event_id, user_id)
);

alter table public.sos_events enable row level security;
alter table public.sos_deliveries enable row level security;
alter table public.sos_acknowledgements enable row level security;

drop policy if exists "circle members can view SOS events" on public.sos_events;
create policy "circle members can view SOS events" on public.sos_events for select using (
  exists (select 1 from public.circle_members cm where cm.circle_id = sos_events.circle_id and cm.user_id = auth.uid())
);
drop policy if exists "circle members can view SOS deliveries" on public.sos_deliveries;
create policy "circle members can view SOS deliveries" on public.sos_deliveries for select using (
  exists (select 1 from public.sos_events se join public.circle_members cm on cm.circle_id = se.circle_id where se.id = sos_deliveries.event_id and cm.user_id = auth.uid())
);
drop policy if exists "circle members can view SOS acknowledgements" on public.sos_acknowledgements;
create policy "circle members can view SOS acknowledgements" on public.sos_acknowledgements for select using (
  exists (select 1 from public.sos_events se join public.circle_members cm on cm.circle_id = se.circle_id where se.id = sos_acknowledgements.event_id and cm.user_id = auth.uid())
);
-- No client insert/update policies are intentionally provided. Writes go through the authenticated Lambda.
