-- Schema do clone (Postgres 15+ / Supabase). Primeira migração.
-- Convenções: uuid em tudo, timestamptz em UTC, dinheiro em centavos (integer) + currency,
-- business_id em tudo que o negócio possui. Acesso: ver "Access rules" no fim do arquivo.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- updated_at automático
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================ login (dono/equipe)

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,                 -- scrypt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,             -- sha256 do token do cookie
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sessions (user_id);
create index on sessions (expires_at);

-- ============================================================ negócio e equipe

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,                                  -- E.164, ex. +14155550123
  timezone text not null default 'America/Los_Angeles',
  currency text not null default 'USD',
  booking_slug text not null unique,           -- /book/<slug>
  logo_url text,
  cancellation_hours int not null default 24,  -- cliente cancela pelo portal até N horas antes
  online_booking_enabled boolean not null default true,
  online_requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid unique references users(id) on delete set null,  -- null = sem login
  name text not null,
  role text not null default 'owner' check (role in ('owner','groomer')),
  color text not null default '#3b82f6',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on staff (business_id);

create table working_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = domingo
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wh_order check (end_time > start_time)
);
create index on working_hours (staff_id, weekday);

-- Bloqueios pontuais (folga, consulta médica, van na oficina)
create table time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint to_order check (end_at > start_at)
);
create index on time_off (staff_id, start_at);

-- Regras de rota (Smart Scheduling): de onde a van sai/volta e limites de direção
create table route_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references staff(id) on delete cascade,
  start_address text not null,
  start_lat double precision not null,
  start_lng double precision not null,
  end_address text,                            -- null = não considerar a volta
  end_lat double precision,
  end_lng double precision,
  max_drive_minutes int not null default 30,
  max_drive_miles numeric(6,1),                -- opcional; EUA usa milhas
  smart_scheduling_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Áreas atendidas: lista de ZIP codes por dia da semana
create table service_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  name text not null,
  zip_codes text[] not null default '{}',
  cities text[] not null default '{}',        -- o site lista cidades, não ZIPs
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on service_areas (business_id);
create index on service_areas using gin (zip_codes);

-- ============================================================ clientes e pets

create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  phone text not null,                         -- E.164
  email text,
  address_line text,
  city text,
  state text default 'CA',
  zip text,
  lat double precision,
  lng double precision,
  access_notes text,                           -- portão, onde estacionar, tomada/água
  sms_consent_at timestamptz,                  -- TCPA: quando o cliente aceitou SMS
  sms_opted_out_at timestamptz,                -- STOP
  marketing_opt_in boolean not null default false,
  source text not null default 'manual' check (source in ('manual','online','import')),
  external_ref text,                           -- id no sistema antigo (import)
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_phone_unique unique (business_id, phone)
);
create index on clients (business_id, last_name, first_name);
create index on clients (business_id, zip);

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on client_notes (client_id, created_at desc);

create table pets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  species text not null default 'dog' check (species in ('dog','cat','other')),
  breed text,
  birth_date date,
  weight_lbs numeric(5,1),
  coat_type text,
  size_class text check (size_class in ('small','medium','large','xlarge')),  -- altura: ≤12", 12–16", 16–20", 20"+
  rebook_every_days int check (rebook_every_days between 7 and 365),            -- frequência de grooming
  sex text check (sex in ('male','female')),
  fixed boolean,
  behavior text,
  vet_name text,
  vet_phone text,
  notes text,
  photo_url text,
  deceased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on pets (client_id);

create table pet_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  label text not null check (char_length(label) <= 8),
  color text not null default '#ef4444',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, label)
);

create table pet_pet_codes (
  pet_id uuid not null references pets(id) on delete cascade,
  pet_code_id uuid not null references pet_codes(id) on delete cascade,
  primary key (pet_id, pet_code_id)
);
create index on pet_pet_codes (pet_code_id);

create table vaccines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  name text not null,                          -- Rabies, DHPP, Bordetella...
  given_on date,
  expires_on date,
  file_url text,
  alert_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vaccines (pet_id);
create index on vaccines (expires_on) where alert_enabled;

-- ============================================================ serviços

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  kind text not null default 'service' check (kind in ('service','addon')),
  category text,                               -- 'Haircut + Bath', 'Bath', 'Add-on'
  size_class text check (size_class in ('small','medium','large','xlarge')),  -- null = qualquer tamanho
  description text,
  duration_min int not null check (duration_min >= 0),  -- add-ons can take no extra time
  price_cents int not null check (price_cents >= 0),
  online_bookable boolean not null default true,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on services (business_id, active, sort_order);

-- Preço/duração por faixa de peso (não usado pelo negócio hoje: preço é por tamanho em altura)
create table service_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  weight_min_lbs numeric(5,1) not null default 0,
  weight_max_lbs numeric(5,1),                 -- null = sem teto
  price_cents int not null check (price_cents >= 0),
  duration_min int not null check (duration_min > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on service_prices (service_id);

-- ============================================================ agendamentos

create table appointment_series (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  freq text not null check (freq in ('day','week','month')),
  interval_n int not null check (interval_n between 1 and 52),
  ends_on date,
  occurrences int check (occurrences between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on appointment_series (business_id);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  staff_id uuid not null references staff(id) on delete restrict,
  series_id uuid references appointment_series(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'unconfirmed' check (status in
    ('requested','waitlist','unconfirmed','confirmed','en_route',
     'in_progress','completed','cancelled','no_show','declined')),
  source text not null default 'manual' check (source in ('manual','online')),
  -- endereço copiado do cliente no momento do agendamento (cliente pode mudar depois)
  address_line text,
  zip text,
  lat double precision,
  lng double precision,
  route_order int,                             -- posição na rota do dia
  drive_minutes_from_prev int,                 -- cache da Routes API
  notes text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appt_order check (end_at > start_at)
);
create index on appointments (business_id, start_at);
create index on appointments (staff_id, start_at);
create index on appointments (client_id, start_at desc);
create index on appointments (series_id);
create index on appointments (business_id, status) where status in ('requested','waitlist');

-- Dois agendamentos ativos do mesmo groomer não se sobrepõem. Problema do banco, não da UI.
alter table appointments add constraint no_double_booking exclude using gist (
  staff_id with =,
  tstzrange(start_at, end_at, '[)') with &&
) where (status in ('requested','unconfirmed','confirmed','en_route','in_progress','completed'));

create table appointment_pets (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, pet_id)
);
create index on appointment_pets (pet_id);

create table appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_pet_id uuid not null references appointment_pets(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  name text not null,                          -- cópia do nome e preço do dia (histórico estável)
  price_cents int not null check (price_cents >= 0),
  duration_min int not null check (duration_min >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on appointment_services (appointment_pet_id);
create index on appointment_services (service_id);

-- ============================================================ contrato (marco 2)

create table agreements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  body text not null,
  version int not null default 1,
  required_online boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agreements (business_id, active);

create table agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references agreements(id) on delete restrict,
  agreement_version int not null,
  client_id uuid not null references clients(id) on delete cascade,
  signed_name text not null,
  signature_url text,
  ip text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agreement_signatures (client_id);
create index on agreement_signatures (agreement_id);

-- ============================================================ checkout

create table invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  appointment_id uuid unique references appointments(id) on delete set null,
  client_id uuid not null references clients(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed','void')),
  currency text not null default 'USD',
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  tax_cents int not null default 0,
  tip_cents int not null default 0,
  total_cents int not null default 0,          -- subtotal - desconto + imposto + gorjeta
  paid_cents int not null default 0,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on invoices (business_id, created_at desc);
create index on invoices (client_id);
create index on invoices (business_id, status);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  kind text not null check (kind in ('service','addon','product','discount','fee')),
  description text not null,
  amount_cents int not null,                   -- negativo para desconto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on invoice_items (invoice_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete restrict,
  method text not null check (method in ('cash','zelle','check','venmo','card','other')),
  amount_cents int not null check (amount_cents >= 0),  -- toward the bill
  tip_cents int not null default 0 check (tip_cents >= 0), -- on top of the bill
  reference text,                              -- nº do cheque, id do Zelle/Venmo
  received_at timestamptz not null default now(),
  staff_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_not_empty check (amount_cents + tip_cents > 0)
);
create index on payments (invoice_id);
create index on payments (received_at);

-- ============================================================ relatório de grooming (marco 2)

create table grooming_reports (
  id uuid primary key default gen_random_uuid(),
  appointment_pet_id uuid not null unique references appointment_pets(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','sent')),
  before_photos text[] not null default '{}',
  after_photos text[] not null default '{}',
  checklist jsonb not null default '{}',       -- {"ears":"clean","skin":"dry",...}
  comment text,
  public_token text not null unique default encode(gen_random_bytes(16),'hex'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ SMS

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  trigger text not null check (trigger in
    ('booked','request_received','request_accepted','request_declined',
     'reminder','confirmed','cancelled','on_my_way','thank_you','report',
     'rebook','review_request','feedback_positive','feedback_negative')),
  body text not null,                          -- com variáveis {{client_first_name}} {{date}} {{time}} {{pet_names}}
  offset_days int,                             -- reminder: dias antes; rebook: dias depois da data esperada
  offset_minutes int,                          -- review_request: minutos depois do checkout
  only_if_unconfirmed boolean not null default false,
  send_at_time time,                           -- só reminder: horário local de envio
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on message_templates (business_id, trigger);

create table messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,   -- null = número desconhecido
  appointment_id uuid references appointments(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  from_phone text not null,
  to_phone text not null,
  body text not null,
  template_trigger text,
  twilio_sid text unique,                      -- idempotência do webhook
  status text not null default 'queued' check (status in
    ('queued','sent','delivered','failed','received','blocked_opt_out')),
  error text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on messages (business_id, client_id, created_at desc);
create index on messages (business_id, created_at desc) where direction = 'in' and read_at is null;

-- Fila de lembretes: um registro por (agendamento, template). Unique = nunca envia duas vezes.
create table scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  template_id uuid not null references message_templates(id) on delete cascade,
  send_at timestamptz not null,
  sent_message_id uuid references messages(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, template_id)
);
create index on scheduled_messages (send_at) where status = 'pending';

-- ============================================================ triggers updated_at

do $$
declare t text;
begin
  for t in select unnest(array[
    'users','sessions','businesses','staff','working_hours','time_off','route_rules','service_areas',
    'clients','client_notes','pets','pet_codes','vaccines','services','service_prices',
    'appointment_series','appointments','appointment_pets','appointment_services',
    'agreements','agreement_signatures','invoices','invoice_items','payments',
    'grooming_reports','message_templates','messages','scheduled_messages'])
  loop
    execute format('create trigger %I_updated_at before update on %I
                    for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================ access rules
-- Escolha: checagem de autorização no data layer. Só o servidor Next.js fala com o
-- banco (conexão direta, nunca do navegador); toda query filtra pelo business_id do
-- staff da sessão. RLS fica LIGADO sem policies: se alguém usar a API pública do
-- Supabase/Neon por engano, não lê nada. O cliente (dono do pet) usa sessão própria
-- depois do código SMS (Twilio Verify) e só enxerga linhas com o seu client_id.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
