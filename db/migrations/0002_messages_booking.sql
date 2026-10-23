-- Free messaging (email via Gmail, SMS sent from the owner's iPhone), public confirm
-- links, online booking settings and the calendar feed.

-- Messages: one row per message, SMS or email. SMS rows wait in the outbox ('queued')
-- until the iPhone Shortcut picks them up ('handed_off').
alter table messages
  add column channel text not null default 'sms' check (channel in ('sms', 'email')),
  add column to_email text,
  add column subject text,
  add column dedupe_key text unique,      -- the same reminder is never created twice
  add column sent_at timestamptz,
  alter column from_phone drop not null,
  alter column to_phone drop not null;
alter table messages drop constraint messages_status_check;
alter table messages add constraint messages_status_check check (status in
  ('queued', 'handed_off', 'sent', 'delivered', 'failed', 'received', 'blocked_opt_out', 'skipped'));
create index on messages (business_id, channel, status) where status = 'queued';

alter table message_templates add column email_subject text;

-- Public link sent to the client to confirm or cancel without logging in.
alter table appointments add column public_token text not null unique default encode(gen_random_bytes(12), 'hex');

alter table businesses
  add column email text,                                  -- where booking requests are announced
  add column device_key text not null default encode(gen_random_bytes(24), 'hex'),  -- iPhone Shortcut + calendar feed
  add column buffer_minutes int not null default 30 check (buffer_minutes between 0 and 180),
  add column max_cluster_miles numeric(5,1) not null default 25,
  add column booking_days_ahead int not null default 45 check (booking_days_ahead between 1 and 180),
  add column min_notice_hours int not null default 24 check (min_notice_hours between 0 and 336),
  add column review_url text,
  add column website_url text;

-- Requests from the booking page: limit abuse per phone per day.
create index on appointments (business_id, created_at) where source = 'online';

-- Where the van starts (private, never shown to clients) and how far the business goes.
alter table businesses
  add column start_zip text,
  add column service_radius_miles numeric(5,1) not null default 50;

-- Reminders are now computed when due instead of being pre-scheduled.
drop table scheduled_messages;
