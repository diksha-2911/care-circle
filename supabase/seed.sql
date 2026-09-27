-- Demo data for the hackathon walkthrough.
-- Run after migrations. Replace UUIDs with real auth.users ids if testing
-- against a real Supabase Auth setup.

insert into users (id, full_name, phone_number) values
  ('11111111-1111-1111-1111-111111111111', 'Meera (Parent)', '+911234500001'),
  ('22222222-2222-2222-2222-222222222222', 'Arjun (Child)', '+911234500002'),
  ('33333333-3333-3333-3333-333333333333', 'Priya (Sibling)', '+911234500003');

insert into care_circles (id, parent_user_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Meera''s Care Circle');

insert into circle_members (circle_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'parent'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'child'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'sibling');

insert into prescriptions (circle_id, drug_name, dosage, frequency_per_day, alarm_times, quantity_remaining, refill_threshold) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Amlodipine', '5mg', 1, '{08:00}', 6, 5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Metformin', '500mg', 2, '{08:00,20:00}', 40, 10);
