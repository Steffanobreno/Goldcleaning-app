-- Owner feedback (2026-10-18):
-- 1. The owner sometimes overlaps visits on purpose (a dog finishes early). Only online
--    requests are kept from overlapping by the database; the owner gets a warning instead.
alter table appointments drop constraint no_double_booking;
alter table appointments add constraint no_double_booking_online exclude using gist (
  staff_id with =,
  tstzrange(start_at, end_at, '[)') with &&
) where (source = 'online' and status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed'));

-- 2. Service time already includes driving, so visits go back to back by default.
alter table businesses alter column buffer_minutes set default 0;
update businesses set buffer_minutes = 0;

-- 3. One photo per pet, stored in the database (resized in the browser, ~100 KB each),
--    so no separate file storage service is needed.
create table pet_photos (
  pet_id uuid primary key references pets(id) on delete cascade,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null check (octet_length(data) <= 1500000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pet_photos_updated_at before update on pet_photos for each row execute function set_updated_at();
alter table pet_photos enable row level security;
