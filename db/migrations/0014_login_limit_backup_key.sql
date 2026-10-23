-- Wrong passwords, to slow down guessing (8 tries per email per 15 minutes).
create table if not exists login_failures (
  email text not null,
  at timestamptz not null default now()
);
create index if not exists login_failures_email on login_failures (email, at);
alter table login_failures enable row level security;

-- The backup has its own key, so the calendar link can't download the client list.
alter table businesses add column if not exists backup_key text not null default encode(gen_random_bytes(24), 'hex');
