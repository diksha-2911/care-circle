# Architecture

Care Circle is split into three independently-deployed pieces, all reading and
writing to one shared Supabase (Postgres) database.

```
                         ┌──────────────────────┐
                         │      Supabase          │
                         │  (Postgres + Auth +    │
                         │   auto-generated API)  │
                         └───────────┬────────────┘
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   React Native App          MCP Server (App Runner)   EventBridge Scheduler
  (talks directly to         (talks to Alexa+,         (fires every N mins,
   Supabase's API)            reads/writes Supabase)     triggers Lambda)
              │                        │                        │
              │                        │                        ▼
              │                        │                  AWS Lambda
              │                        │              (queries Supabase,
              │                        │               decides what's due)
              │                        │                        │
              └────────────────────────┴────────────┬───────────┘
                                                      ▼
                                    FCM (push) + Amazon SNS (SMS/SOS)
```

## Why three pieces instead of one backend?

- **`app/`** is the *screen* — setup, configuration, manual logging, and
  monitoring for family members who aren't talking to Alexa+.
- **`mcp-server/`** is the *voice* — it only exists to let Alexa+ read and
  write the same data conversationally ("Alexa, did mom take her medication?").
  It implements the MCP spec (2025-11-25) over Streamable HTTP, plus MCP Apps
  for inline visual widgets (e.g. a medication schedule card).
- **`scheduler/`** is the *heartbeat* — the only piece that runs on a timer,
  independent of anyone opening the app or talking to Alexa+. This can't live
  inside the mobile app because apps don't reliably run code when closed or
  backgrounded; it has to be a real always-on/scheduled server-side process.

None of these three "call" each other directly — they're decoupled, and only
share state through Supabase.

## Data model (see `supabase/migrations/0001_init.sql`)

Authentication and authorization are deliberately separate:
- **Authentication** (who you are) is entirely Supabase Auth's job —
  `users` just mirrors `auth.users` with profile fields.
- **Authorization** (what you can do, in which family group) lives in
  `circle_members` — a per-circle role plus fine-grained permission flags,
  so the same person could have different permissions in two different
  care circles.

Tables:
- `users` — account holders, linked to Supabase Auth
- `care_circles` — one shared family group per patient
- `circle_members` — role (`patient` | `caregiver`) + permission flags:
  `can_manage_medications`, `can_view_health_data`, `can_manage_members`,
  `can_trigger_sos`, `receives_sos_alerts`. A database check constraint
  guarantees a `caregiver` row can never have `can_trigger_sos = true` —
  only the patient can trigger SOS, though any caregiver can still
  receive SOS alerts and can still manage circle membership (invite/remove
  people) by default.
- `circle_invitations` — short codes an admin/patient generates so a
  family member can join with a pre-set role. Redeeming a code happens
  through a trusted server-side function (service role), since the
  invitee has no `circle_members` row yet to satisfy RLS on their own.
- `prescriptions` — drug, dosage, frequency, quantity remaining, refill threshold
- `dose_logs` — who logged a dose, when, taken/missed
- `appointments` — doctor visits, dates, notes
- `care_notes` — free-form updates between family members (open to all
  circle members, not gated by health-data permissions)

Row Level Security is enabled and policy-backed on every table: reads are
scoped by `can_view_health_data`, writes to medical data require
`can_manage_medications`, and membership/invite management requires
`can_manage_members`.

## Notification flow

1. `EventBridge Scheduler` fires every few minutes.
2. It invokes the `scheduler/` Lambda, which queries Supabase for:
   - doses due now / overdue
   - prescriptions below their refill threshold
   - upcoming appointments
3. For each match, `notify.py` sends alerts via Firebase Cloud Messaging
   (push, to the app) and, for SOS specifically, also via Amazon SNS (SMS) —
   redundant delivery so an emergency alert can't be missed due to one
   channel failing.

## What's stubbed for the hackathon demo

See `docs/demo-script.md`.