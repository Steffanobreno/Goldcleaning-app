-- Abandoned online bookings: what someone typed on the booking page before they stopped.
-- A while later they get one "finish booking" message and the owner is told, so they can call.
create table if not exists booking_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,  -- when it's a known client
  phone text not null,                                       -- E.164
  first_name text,
  last_name text,
  email text,
  zip text,
  pets text,                                                 -- "Biscuit (Bath)", for the message and the owner
  step text not null default 'phone',                        -- how far they got
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,                                  -- they sent the request
  reminded_at timestamptz,                                   -- the message went out
  dismissed_at timestamptz                                   -- the owner cleared it
);
create index if not exists booking_drafts_open on booking_drafts (business_id, updated_at) where completed_at is null;
alter table booking_drafts enable row level security;

alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked','request_received','request_accepted','request_declined',
   'reminder','confirmed','cancelled','on_my_way','thank_you','report',
   'rebook','review_request','feedback_positive','feedback_negative','vaccine_due','abandoned_booking'));

insert into message_templates (business_id, trigger, body, email_subject, offset_minutes)
select b.id, 'abandoned_booking',
  'Hi {client}! Looks like you didn''t get to finish booking {pet}''s visit with {business}. Pick a time here: {booking_url} or text us at {business_phone} and we''ll book it for you. 🐾',
  'Finish booking {pet}''s spa day?', 120
from businesses b
where not exists (select 1 from message_templates t where t.business_id = b.id and t.trigger = 'abandoned_booking');
