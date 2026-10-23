-- When the weekly Google Drive backup last ran (Settings → Backups).
alter table businesses add column if not exists backup_at timestamptz;
-- Groomers (Settings → Team): a phone and email to reach them.
alter table staff add column if not exists phone text;
alter table staff add column if not exists email text;
