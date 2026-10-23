-- The inbox preview line of a campaign, the monthly "time for this month's email" reminder,
-- and the Woofers mailing address for the footer of marketing emails.
alter table campaigns add column if not exists preheader text not null default '';
alter table businesses add column if not exists marketing_reminder boolean not null default true;
alter table businesses add column if not exists marketing_reminded_month text; -- 'yyyy-MM' of the last reminder
update businesses set mailing_address = '1201 Monte Diablo Ave, San Mateo, CA 94401'
where mailing_address is null and name ilike 'Woofers%';
