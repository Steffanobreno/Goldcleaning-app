-- The waitlist: clients who want a day (or a few days) that is full. When a visit on one of
-- those days is cancelled, Today and the Waitlist screen say a spot opened.
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text,
  status text not null default 'waiting' check (status in ('waiting', 'booked', 'removed')),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists waitlist_business_waiting on waitlist (business_id, from_date) where status = 'waiting';
alter table waitlist enable row level security;
