-- Vaccine reminders: a message to the client some days before a pet's vaccine expires.
alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked','request_received','request_accepted','request_declined',
   'reminder','confirmed','cancelled','on_my_way','thank_you','report',
   'rebook','review_request','feedback_positive','feedback_negative','vaccine_due'));

insert into message_templates (business_id, trigger, body, email_subject, offset_days, send_at_time)
select b.id, 'vaccine_due',
  'Hi {client}! Our records show {pet}''s {vaccine} vaccine expires on {expires}. When it''s renewed, please text a photo of the new certificate to {business_phone}. Thank you! 🐾 {business}',
  '{pet}''s {vaccine} vaccine expires soon', 30, '10:00'
from businesses b
where not exists (select 1 from message_templates t where t.business_id = b.id and t.trigger = 'vaccine_due');

create index if not exists vaccines_expires on vaccines (expires_on) where alert_enabled;
