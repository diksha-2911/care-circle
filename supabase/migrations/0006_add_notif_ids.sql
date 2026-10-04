-- Stores the device-local expo-notifications IDs for each prescription's
-- scheduled alarms, so they can be cancelled/rescheduled on edit or
-- delete. Nullable array since this is populated client-side after
-- scheduling succeeds, not at insert time.
alter table prescriptions add column notification_ids text[];