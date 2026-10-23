-- Blocked time on the calendar (lunch, the van at the shop, a day off). A block that repeats
-- every week is one row per week sharing a series_id, so one can be moved or removed alone.
alter table time_off add column if not exists series_id uuid;
create index if not exists time_off_series on time_off (series_id) where series_id is not null;

-- Map of the day: addresses are turned into map points once (free US Census geocoder).
-- geocode_tried_at stops the app from asking again for an address it couldn't find.
alter table appointments add column if not exists geocode_tried_at timestamptz;
