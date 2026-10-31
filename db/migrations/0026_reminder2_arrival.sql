-- A second reminder, an arrival window ("9:00 AM" reads "9:00 AM – 9:45 AM" in emails), and a switch
-- for the receipt email.
alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check check (trigger in
  ('booked', 'request_received', 'request_accepted', 'request_declined', 'reminder', 'reminder_2', 'confirmed',
   'cancelled', 'thank_you', 'rebook', 'review_request', 'feedback_positive', 'feedback_negative',
   'abandoned_booking', 'quote_received', 'quote_new'));

insert into message_templates (business_id, trigger, body, email_subject, offset_days, send_at_time, enabled)
select b.id, 'reminder_2',
  E'Hi {client}! See you tomorrow, {date}, at {time} for your {service} with {business}. Need to change it? {appointment_url}\n\nPeninsula Gold Cleaning · (650) 434-2080',
  'See you tomorrow, {date}', 1, '10:00', false
from businesses b
where not exists (select 1 from message_templates t where t.business_id = b.id and t.trigger = 'reminder_2');

alter table businesses add column if not exists arrival_before_min int not null default 0 check (arrival_before_min between 0 and 240);
alter table businesses add column if not exists arrival_after_min int not null default 0 check (arrival_after_min between 0 and 240);
alter table businesses add column if not exists receipt_email_enabled boolean not null default true;
