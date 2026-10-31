-- Business address and links, and the days the business is closed (vacations, holidays).
alter table businesses add column if not exists address_line text;
alter table businesses add column if not exists city text;
alter table businesses add column if not exists state text;
alter table businesses add column if not exists zip text;
alter table businesses add column if not exists facebook_url text;
alter table businesses add column if not exists instagram_url text;
alter table businesses add column if not exists yelp_url text;
alter table businesses add column if not exists google_url text;
-- Keys of the US holidays the business takes off, ex. '{thanksgiving,christmas}'.
alter table businesses add column if not exists closed_holidays text[] not null default '{}';

-- Vacations and other days off for the whole business: no online bookings, warned when booking by hand.
create table if not exists closed_dates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint closed_order check (end_date >= start_date)
);
create index if not exists closed_dates_business on closed_dates (business_id, end_date);
alter table closed_dates enable row level security;
