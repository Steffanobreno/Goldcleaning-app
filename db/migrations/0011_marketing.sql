-- Email marketing: campaigns sent to a filtered list of clients.
-- US law (CAN-SPAM) lets a business email its own clients until they unsubscribe; every
-- campaign email carries an unsubscribe link (marketing_token) and the business mailing address.
alter table businesses add column if not exists mailing_address text;
alter table clients add column if not exists email_unsubscribed_at timestamptz;
alter table clients add column if not exists marketing_token text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists clients_marketing_token on clients (marketing_token);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  template text,                               -- the starting template (e.g. 'halloween')
  subject text not null default '',
  banner text,                                 -- picture on top: '/marketing/halloween.jpg'
  headline text not null default '',
  body text not null default '',
  button_label text,
  button_url text,
  filters jsonb not null default '{}',         -- who gets it (see src/lib/data/marketing.ts)
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_business on campaigns (business_id, created_at desc);
alter table campaigns enable row level security;

-- One row per client a campaign goes to, taken when sending starts.
create table if not exists campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text,
  unique (campaign_id, client_id)
);
create index if not exists campaign_recipients_queue on campaign_recipients (campaign_id, status);
alter table campaign_recipients enable row level security;
create or replace trigger campaigns_updated_at before update on campaigns for each row execute function set_updated_at();
