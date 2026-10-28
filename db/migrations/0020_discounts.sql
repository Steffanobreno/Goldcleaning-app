-- Price changes per home and a list of discounts.
-- A home can carry a standing adjustment (+ or − dollars per visit, e.g. an older client who pays a
-- bit less) and standing discounts. A discount with a code is a coupon the client types on the
-- booking page; the owner can also give any discount to a single visit.

alter table homes
  add column price_adjust_cents int not null default 0 check (abs(price_adjust_cents) <= 1000000),
  add column price_adjust_note text;

create table discounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  code text,                                    -- set: a coupon clients type; empty: given by the owner
  kind text not null check (kind in ('percent', 'amount')),
  percent numeric(5, 2),
  amount_cents int,
  first_time_only boolean not null default false, -- the coupon only works for someone with no earlier visit
  starts_on date,
  ends_on date,
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'percent' and percent > 0 and percent <= 100 and amount_cents is null)
      or (kind = 'amount' and amount_cents > 0 and percent is null))
);
create unique index discounts_code_unique on discounts (business_id, lower(code)) where code is not null;
create index on discounts (business_id, active);
alter table discounts enable row level security;

-- Standing discounts of a home: applied to every visit booked for it.
create table home_discounts (
  home_id uuid not null references homes(id) on delete cascade,
  discount_id uuid not null references discounts(id) on delete cascade,
  primary key (home_id, discount_id)
);
alter table home_discounts enable row level security;

-- Price lines: 'rate' (a home's standing adjustment) and 'discount' (standing) repeat with a series;
-- 'coupon' (a code or a one-off discount) is for that visit only.
alter table appointment_lines drop constraint appointment_lines_kind_check;
alter table appointment_lines
  add constraint appointment_lines_kind_check check (kind in ('service', 'room', 'extra', 'adjustment', 'rate', 'discount', 'coupon')),
  add column discount_id uuid references discounts(id) on delete set null;
