-- Online booking automation: which requests book themselves without the owner accepting.
-- 'none' = every request waits for the owner; 'returning' = clients already on file; 'all' = everyone.
alter table businesses add column if not exists auto_accept text not null default 'none'
  check (auto_accept in ('none', 'returning', 'all'));

-- Online booking open a whole year ahead (it was 60 days, at most 180). Up to two years.
alter table businesses drop constraint if exists businesses_booking_days_ahead_check;
alter table businesses add constraint businesses_booking_days_ahead_check check (booking_days_ahead between 1 and 730);
alter table businesses alter column booking_days_ahead set default 365;
update businesses set booking_days_ahead = 365 where booking_days_ahead < 365;
