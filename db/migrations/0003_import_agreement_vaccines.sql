-- Switching over from the old app: imports, a master switch for automatic messages,
-- the service agreement and vaccines.

-- Off until the owner stops using the old app, so clients never get every message twice.
alter table businesses add column auto_messages_enabled boolean not null default false;

-- What we know from the old app about each client's last visit (drives rebook reminders
-- until there is a visit in this app).
alter table clients
  add column imported_last_service_at timestamptz,
  add column imported_total_sales_cents int;

-- Bitcoin is accepted per the service agreement.
alter table payments drop constraint payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'zelle', 'check', 'venmo', 'bitcoin', 'card', 'other'));

-- Agreement signatures: who typed their name, when, from where (no drawn signature).
create index if not exists agreement_signatures_client_signed on agreement_signatures (client_id, signed_at desc);
