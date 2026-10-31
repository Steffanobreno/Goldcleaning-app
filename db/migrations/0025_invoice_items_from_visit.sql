-- Bill items that come from the visit's price lines (so they follow the visit when it is re-priced),
-- as opposed to a discount, charge or tax added by hand on the bill.
alter table invoice_items add column if not exists from_visit boolean not null default false;
