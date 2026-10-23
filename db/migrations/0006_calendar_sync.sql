-- When the Google Apps Script last read the calendar feed, shown in Settings so the owner
-- can see the sync is running.
alter table businesses add column if not exists calendar_synced_at timestamptz;
