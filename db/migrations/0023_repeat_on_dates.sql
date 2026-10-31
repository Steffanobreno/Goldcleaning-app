-- A visit can repeat on dates picked one by one (not only every N days/weeks/months).
alter table appointment_series drop constraint if exists appointment_series_freq_check;
alter table appointment_series add constraint appointment_series_freq_check check (freq in ('day', 'week', 'month', 'dates'));
