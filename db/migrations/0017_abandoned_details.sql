-- More of what was typed on an abandoned booking, for its detail page, and when the owner
-- reached out (for the Contacted / Recovered status).
alter table booking_drafts add column if not exists address_line text;
alter table booking_drafts add column if not exists city text;
alter table booking_drafts add column if not exists pet_details jsonb;      -- [{name, breed, size, service, addons}]
alter table booking_drafts add column if not exists chosen_start timestamptz; -- the time they picked, if they got that far
alter table booking_drafts add column if not exists contacted_at timestamptz; -- the owner texted or called from the app
