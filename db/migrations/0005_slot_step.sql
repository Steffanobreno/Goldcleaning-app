-- Owner feedback (2026-10-19): online start times sit on a fixed grid (every 2 hours by
-- default: 7, 9, 11, 1...) whatever the visit length. Two X-Large dogs (6 hours) can start
-- at 7, 9, 11 or 1, as long as the visit ends by closing time.
alter table businesses add column if not exists slot_minutes int not null default 120
  check (slot_minutes between 15 and 240);
