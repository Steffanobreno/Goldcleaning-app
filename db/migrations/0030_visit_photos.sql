-- Photos of a cleaning (before, after, or a problem spot), kept with the visit and its home.
create table if not exists visit_photos (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  home_id uuid references homes(id) on delete set null,
  kind text not null default 'other' check (kind in ('before', 'after', 'other')),
  content_type text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists visit_photos_appointment on visit_photos (appointment_id, created_at);
create index if not exists visit_photos_home on visit_photos (home_id, created_at desc);
alter table visit_photos enable row level security;
