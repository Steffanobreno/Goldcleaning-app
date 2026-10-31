-- The owner's own lists for clients: tags (VIP, every 2 weeks…) and where clients found you.
create table if not exists option_lists (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('client_tag', 'referral_source')),
  label text not null check (char_length(label) between 1 and 60),
  sort_order int not null default 0,
  unique (business_id, kind, label)
);
alter table option_lists enable row level security;
-- The defaults go in once; after that, removing every item leaves the list empty.
alter table businesses add column if not exists options_seeded boolean not null default false;

-- Tags are saved as text so renaming or removing a list item never touches a client.
create table if not exists client_tags (
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  primary key (client_id, label)
);
alter table client_tags enable row level security;
alter table clients add column if not exists referral_source text;
