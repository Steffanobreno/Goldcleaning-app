-- Per-client switches on the client profile: keep someone from booking online
-- (they text instead). "Inactive" uses archived_at; "block messages" uses sms_opted_out_at.
alter table clients add column if not exists online_booking_blocked boolean not null default false;
