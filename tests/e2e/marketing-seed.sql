-- Extra clients for tests/e2e/marketing.mjs (run after slice.mjs and booking.mjs):
-- psql "$DATABASE_URL" -f tests/e2e/marketing-seed.sql
insert into clients (business_id, first_name, last_name, phone, email, city, imported_last_service_at, email_unsubscribed_at)
select b.id, v.first_name, v.last_name, v.phone, v.email, v.city, v.last_at, v.unsub
from businesses b, (values
  ('Bella', 'Long', '+16505550101', 'bella@example.com', 'Redwood City', now() - interval '100 days', null::timestamptz),
  ('Carl', 'Short', '+16505550102', 'carl@example.com', 'Redwood City', now() - interval '20 days', null),
  ('Dina', 'New', '+16505550103', 'dina@example.com', 'Palo Alto', null, null),
  ('Eve', 'Gone', '+16505550104', 'eve@example.com', 'Palo Alto', now() - interval '200 days', now())
) as v(first_name, last_name, phone, email, city, last_at, unsub);
insert into pets (client_id, name, breed)
select c.id, 'Biscuit', 'Goldendoodle' from clients c where c.first_name = 'Bella';
