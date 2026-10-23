-- Checkout like the old app: check-in and check-out times on the visit (editable), taxes or
-- service charges on the bill, and a note on each payment ("Paid by", description).
alter table appointments add column if not exists checked_in_at timestamptz;
alter table appointments add column if not exists checked_out_at timestamptz;

alter table invoice_items drop constraint invoice_items_kind_check;
alter table invoice_items add constraint invoice_items_kind_check
  check (kind in ('service', 'addon', 'product', 'discount', 'fee', 'tax'));

alter table payments add column if not exists paid_by text;
alter table payments add column if not exists note text;
