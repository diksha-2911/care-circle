-- Notification delivery ledger used by scheduler/src/handler.py.
-- One row represents one alert event, not one individual device delivery.

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  alert_type text not null check (
    alert_type in ('missed_dose', 'refill_needed', 'appointment_reminder')
  ),
  -- Polymorphic reference: dose_logs.id, prescriptions.id, or appointments.id.
  reference_id uuid not null,
  status text not null default 'processing' check (
    status in ('processing', 'sent', 'failed')
  ),
  attempt_count integer not null default 1 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  -- A processing claim is recoverable if a Lambda invocation dies mid-send.
  claim_expires_at timestamptz not null default (now() + interval '10 minutes'),
  constraint notification_logs_event_unique unique (alert_type, reference_id)
);

create index if not exists notification_logs_circle_created_idx
  on public.notification_logs (circle_id, created_at desc);

create index if not exists notification_logs_status_claim_idx
  on public.notification_logs (status, claim_expires_at);

-- Notification delivery records are backend-owned. The Lambda uses the
-- Supabase service-role key; mobile clients must not read or mutate this table.
alter table public.notification_logs enable row level security;
revoke all on public.notification_logs from anon, authenticated;
grant select, insert, update, delete on public.notification_logs to service_role;
