-- Notifications on the owner's phone (web push, free). The keys that sign them are made by
-- the app the first time and kept here, so there is nothing to set up on the server.
alter table businesses add column if not exists vapid_public text;
alter table businesses add column if not exists vapid_private text;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_business on push_subscriptions (business_id);
alter table push_subscriptions enable row level security;

-- A client can ask for another time from their link; the owner moves the visit.
alter table appointments add column if not exists reschedule_requested_at timestamptz;
alter table appointments add column if not exists reschedule_note text;
