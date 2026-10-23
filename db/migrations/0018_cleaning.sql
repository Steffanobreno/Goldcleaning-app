-- From dog grooming to house cleaning (Peninsula Gold Cleaning). See docs/design.md.
-- Pets become homes; an appointment's services become price lines (service, extra rooms,
-- extras, adjustments). Prices come from per-service rates; online times from fixed daily slots.

-- ============================================================ homes (were pets)

drop table if exists pet_pet_codes, pet_codes, vaccines, pet_photos, grooming_reports cascade;

alter table pets rename to homes;
alter table homes
  drop column species, drop column breed, drop column birth_date, drop column weight_lbs,
  drop column coat_type, drop column size_class, drop column rebook_every_days, drop column sex,
  drop column fixed, drop column behavior, drop column vet_name, drop column vet_phone,
  drop column photo_url, drop column deceased_at;
alter table homes rename column name to label;
alter table homes alter column label set default 'Home';
alter table homes
  add column address_line text,
  add column city text,
  add column state text default 'CA',
  add column zip text,
  add column lat double precision,
  add column lng double precision,
  add column bedrooms smallint not null default 1 check (bedrooms between 0 and 7),
  add column full_baths smallint not null default 1 check (full_baths between 1 and 7),
  add column half_baths smallint not null default 0 check (half_baths between 0 and 7),
  add column access_method text check (access_method in ('home', 'key', 'lockbox', 'door_code')),
  add column access_code text,
  add column parking_notes text,
  add column pets_in_home text,
  add column product_preferences text,
  add column archived_at timestamptz;
alter index pets_pkey rename to homes_pkey;

-- ============================================================ services, rates and extras

drop table if exists service_prices cascade;
update services set kind = 'extra' where kind = 'addon';
alter table services drop constraint services_kind_check;
alter table services add constraint services_kind_check check (kind in ('service', 'extra'));
alter table services drop column size_class;
alter table services
  add column pricing text not null default 'rate' check (pricing in ('rate', 'quote')),
  add column recurring boolean not null default false,
  add column per_unit boolean not null default false,
  add column icon text;

create table service_rates (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  frequency text not null check (frequency in ('one_time', 'weekly', 'biweekly', 'every_4_weeks')),
  start_cents int not null check (start_cents >= 0),      -- 1 bedroom / 1 bathroom
  bedroom_cents int not null check (bedroom_cents >= 0),  -- each bedroom after the first
  full_bath_cents int not null check (full_bath_cents >= 0),
  half_bath_cents int not null check (half_bath_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, frequency)
);
alter table service_rates enable row level security;
create trigger service_rates_updated_at before update on service_rates for each row execute function set_updated_at();

-- ============================================================ appointments: one home, price lines

alter table appointment_pets rename to appointment_homes;
alter table appointment_homes rename column pet_id to home_id;

alter table appointment_services rename to appointment_lines;
alter table appointment_lines rename column appointment_pet_id to appointment_home_id;
alter table appointment_lines alter column service_id drop not null;
alter table appointment_lines
  add column kind text not null default 'service' check (kind in ('service', 'room', 'extra', 'adjustment')),
  add column qty int not null default 1 check (qty >= 0);
-- price_cents is the line amount (qty × unit); an adjustment may be negative.
alter table appointment_lines drop constraint appointment_services_price_cents_check;

alter table appointments
  add column service_id uuid references services(id) on delete set null,
  add column frequency text not null default 'one_time'
    check (frequency in ('one_time', 'weekly', 'biweekly', 'every_4_weeks')),
  drop column route_order,
  drop column drive_minutes_from_prev;

-- ============================================================ business rules

drop table if exists route_rules, service_areas cascade;
alter table businesses
  drop column buffer_minutes,
  drop column max_cluster_miles,
  drop column slot_minutes,
  drop column start_zip,
  drop column service_radius_miles,
  add column service_cities text[] not null default '{}',
  add column base_duration_min int not null default 180 check (base_duration_min between 30 and 600),
  add column large_home_bedrooms int not null default 3 check (large_home_bedrooms between 0 and 7),
  add column large_home_extra_min int not null default 60 check (large_home_extra_min between 0 and 480);
alter table businesses alter column booking_days_ahead set default 60;

-- Online start times: "Morning" 09:00 and "Afternoon" 13:00 on weekdays.
create table booking_slots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_time time not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, weekday, start_time)
);
alter table booking_slots enable row level security;
create trigger booking_slots_updated_at before update on booking_slots for each row execute function set_updated_at();

-- ============================================================ quote requests (Airbnb, Office)

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('airbnb', 'office')),
  first_name text not null,
  last_name text not null default '',
  email text not null,
  phone text not null,                       -- E.164
  city text,
  zip text,
  bedrooms smallint check (bedrooms between 0 and 20),
  full_baths smallint check (full_baths between 0 and 20),
  square_feet int check (square_feet between 0 and 1000000),
  frequency text,
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'replied', 'converted', 'archived')),
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_requests_open on quote_requests (business_id, created_at desc) where status in ('new', 'replied');
alter table quote_requests enable row level security;
create trigger quote_requests_updated_at before update on quote_requests for each row execute function set_updated_at();

create table quote_request_photos (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references quote_requests(id) on delete cascade,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null check (octet_length(data) <= 1500000),
  created_at timestamptz not null default now()
);
create index on quote_request_photos (quote_request_id);
alter table quote_request_photos enable row level security;

-- ============================================================ abandoned bookings

alter table booking_drafts rename column pets to summary;          -- "Regular Clean · Weekly · 3 bd / 2 ba"
alter table booking_drafts rename column pet_details to details;   -- {service, frequency, bedrooms, fullBaths, halfBaths, extras, totalCents}
alter table booking_drafts alter column step set default 'contact';

-- ============================================================ email templates

delete from message_templates where trigger in ('on_my_way', 'report', 'vaccine_due');
alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked', 'request_received', 'request_accepted', 'request_declined', 'reminder', 'confirmed',
   'cancelled', 'thank_you', 'rebook', 'review_request', 'feedback_positive', 'feedback_negative',
   'abandoned_booking', 'quote_received', 'quote_new'));
