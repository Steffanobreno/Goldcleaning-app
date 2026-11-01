-- A home's usual price: for older clients whose price is not on the price list. When set, the cleaning
-- (service and rooms) is one line at this price for every visit booked for the home; extras still add.
alter table homes
  add column usual_price_cents int check (usual_price_cents is null or (usual_price_cents > 0 and usual_price_cents <= 1000000));
