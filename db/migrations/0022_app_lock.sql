-- App lock: a PIN asked when the app is opened again on a phone.
alter table staff add column if not exists pin_hash text;
alter table staff add column if not exists pin_failures int not null default 0;
