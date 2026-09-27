-- Demo data for the hackathon walkthrough.
-- Run after migrations. Replace UUIDs with real auth.users ids if testing
-- against a real Supabase Auth setup.

insert into users (id, full_name, phone_number) values
  ('11111111-1111-1111-1111-111111111111', 'Meera (Patient)', '+911234500001'),
  ('22222222-2222-2222-2222-222222222222', 'Arjun (Son, Caregiver)', '+911234500002'),
  ('33333333-3333-3333-3333-333333333333', 'Priya (Daughter, Caregiver)', '+911234500003');

insert into care_circles (id, patient_user_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Meera''s Care Circle');

-- Meera: patient — manages her own medications and is the only one who
-- can trigger SOS.
insert into circle_members (circle_id, user_id, role, can_manage_medications, can_view_health_data, can_manage_members, can_trigger_sos, receives_sos_alerts) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'patient', true, true, true, true, true);

-- Arjun: caregiver — view medications/adherence/appointments, can invite
-- other family members, cannot trigger SOS (only receive alerts).
insert into circle_members (circle_id, user_id, role, can_manage_medications, can_view_health_data, can_manage_members, can_trigger_sos, receives_sos_alerts) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'caregiver', false, true, true, false, true);

-- Priya: caregiver — same permission shape as Arjun.
insert into circle_members (circle_id, user_id, role, can_manage_medications, can_view_health_data, can_manage_members, can_trigger_sos, receives_sos_alerts) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'caregiver', false, true, true, false, true);

insert into prescriptions (circle_id, drug_name, dosage, frequency_per_day, alarm_times, quantity_remaining, refill_threshold) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Amlodipine', '5mg', 1, '{08:00}', 6, 5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Metformin', '500mg', 2, '{08:00,20:00}', 40, 10);

-- Example pending invitation (e.g. a second sibling not yet joined).
insert into circle_invitations (circle_id, invited_by_user_id, code, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'FAM-7XQ2', 'caregiver');