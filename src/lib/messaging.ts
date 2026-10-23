import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { sql } from "./db";
import { emailConfigured, sendEmail, type EmailDetails } from "./email";
import { sendPush } from "./push";
import { clientEvent } from "./client-calendar";
import { lastSentByTemplate, processCampaigns } from "./data/marketing";
import { nextDate, suggestions } from "./marketing-templates";
import { addDaysYmd, dayRangeUtc, hm, money, phoneLabel, todayYmd, ymd } from "./format";

// Every client message goes through here. A message is a row in `messages`:
// - email rows are sent right away from the business Gmail;
// - SMS rows wait in the outbox until the owner's iPhone Shortcut collects and sends them.
// `dedupe_key` is unique, so running the same step twice never sends twice.
//
// "Automatic messages" (auto_messages_enabled) starts off, so clients don't get doubles while
// the old app still sends its own. Visits booked on the online booking page are the
// exception: the old app doesn't know them, so their messages always go out.

export type Trigger =
  | "booked"
  | "request_received"
  | "request_accepted"
  | "request_declined"
  | "reminder"
  | "confirmed"
  | "cancelled"
  | "on_my_way"
  | "rebook"
  | "review_request"
  | "abandoned_booking"
  | "quote_received"
  | "quote_new";

export type Template = {
  body: string;
  email_subject: string | null;
  offset_days: number | null;
  offset_minutes: number | null;
  send_at_time: string | null;
  only_if_unconfirmed: boolean;
};

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function render(text: string, vars: Record<string, string | number | null | undefined>) {
  return text.replace(/\{(\w+)\}/g, (all, key) => (vars[key] != null ? String(vars[key]) : all));
}

async function template(businessId: string, trigger: Trigger) {
  const [t] = await sql<Template[]>`
    select body, email_subject, offset_days, offset_minutes, to_char(send_at_time, 'HH24:MI') as send_at_time,
           only_if_unconfirmed
    from message_templates where business_id = ${businessId} and trigger = ${trigger} and enabled
    limit 1`;
  return t ?? null;
}

type ApptContext = {
  id: string | null; // null for client-level messages (e.g. rebook for an imported client)
  business_id: string;
  start_at: Date;
  status: string;
  public_token: string;
  business_name: string;
  business_phone: string | null;
  timezone: string;
  website_url: string | null;
  review_url: string | null;
  client_id: string;
  first_name: string;
  phone: string;
  email: string | null;
  sms_ok: boolean;
  service: string | null; // "Regular Clean · 3 bd / 2 ba"
  total_cents: number;
  source: string;
};

async function autoMessagesOn(businessId: string) {
  const [b] = await sql<{ on: boolean }[]>`select auto_messages_enabled as on from businesses where id = ${businessId}`;
  return !!b?.on;
}

async function appointmentContext(appointmentId: string) {
  const [row] = await sql<ApptContext[]>`
    select a.id, a.business_id, a.start_at, a.status, a.public_token, a.source,
           b.name as business_name, b.phone as business_phone, b.timezone, b.website_url, b.review_url,
           c.id as client_id, c.first_name, c.phone, c.email,
           (c.sms_consent_at is not null and c.sms_opted_out_at is null) as sms_ok,
           (select concat_ws(' · ', sv.name,
                     case when h.bedrooms = 0 then 'Studio' else h.bedrooms || ' bd' end || ' / ' || h.full_baths || ' ba')
            from appointment_homes ah join homes h on h.id = ah.home_id
            where ah.appointment_id = a.id order by ah.created_at limit 1) as service,
           coalesce((select sum(l.price_cents) from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
                     where ah.appointment_id = a.id), 0)::int as total_cents
    from appointments a
    left join services sv on sv.id = a.service_id
    join businesses b on b.id = a.business_id
    join clients c on c.id = a.client_id
    where a.id = ${appointmentId}`;
  return row ?? null;
}

export const bookingUrl = (b: { website_url: string | null }) => b.website_url ?? `${appUrl()}/book`;
export const appointmentLink = (token: string) => `${appUrl()}/a/${token}`;

function varsFor(c: ApptContext, extra: Record<string, string | number> = {}) {
  return {
    business: c.business_name,
    business_phone: phoneLabel(c.business_phone),
    client: c.first_name,
    service: c.service ?? "cleaning",
    total: money(c.total_cents),
    date: formatInTimeZone(c.start_at, c.timezone, "EEE, MMM d"),
    time: formatInTimeZone(c.start_at, c.timezone, "h:mm a"),
    link: c.public_token ? appointmentLink(c.public_token) : bookingUrl(c),
    booking_url: bookingUrl(c),
    review_url: c.review_url ?? "",
    ...extra,
  };
}

/** Creates the SMS and email rows for one message (each only if the client can receive it). */
async function enqueue(c: ApptContext, trigger: Trigger, t: Template, dedupe: string, extra?: Record<string, string | number>) {
  const vars = varsFor(c, extra);
  const body = render(t.body, vars);
  if (c.sms_ok) {
    await sql`
      insert into messages (business_id, client_id, appointment_id, direction, channel, to_phone, body,
                            template_trigger, status, dedupe_key)
      values (${c.business_id}, ${c.client_id}, ${c.id}, 'out', 'sms', ${c.phone}, ${body}, ${trigger}, 'queued',
              ${`${dedupe}:sms`})
      on conflict (dedupe_key) do nothing`;
  }
  if (c.email) {
    const subject = render(t.email_subject ?? `${c.business_name}`, vars);
    await sql`
      insert into messages (business_id, client_id, appointment_id, direction, channel, to_email, subject, body,
                            template_trigger, status, dedupe_key)
      values (${c.business_id}, ${c.client_id}, ${c.id}, 'out', 'email', ${c.email}, ${subject}, ${body}, ${trigger},
              'queued', ${`${dedupe}:email`})
      on conflict (dedupe_key) do nothing`;
  }
}

/**
 * Sends a message about an appointment because something just happened
 * (booked, cancelled, request received...). Emails go out immediately.
 */
export async function notifyAppointment(appointmentId: string, trigger: Trigger) {
  const c = await appointmentContext(appointmentId);
  if (!c || (c.source !== "online" && !(await autoMessagesOn(c.business_id)))) return;
  const t = await template(c.business_id, trigger);
  if (!t) return;
  // Keyed on the start time, so a rescheduled visit gets a fresh "booked" message.
  await enqueue(c, trigger, t, `${trigger}:${c.id}:${c.start_at.getTime()}`);
  await sendQueuedEmails(c.business_id);
}

/**
 * A quote request came in: the "we'll get back to you" email to the client (part of the online
 * flow, so it goes out even before automatic messages are on) and a heads-up to the owner.
 */
export async function notifyQuote(quoteId: string) {
  const [q] = await sql<{ business_id: string; first_name: string; last_name: string; email: string; phone: string;
                         kind: string; city: string | null; message: string; business: string; business_phone: string | null }[]>`
    select q.business_id, q.first_name, q.last_name, q.email, q.phone, q.kind, q.city, q.message,
           b.name as business, b.phone as business_phone
    from quote_requests q join businesses b on b.id = q.business_id where q.id = ${quoteId}`;
  if (!q) return;
  const vars = { client: q.first_name, business: q.business, business_phone: phoneLabel(q.business_phone) };
  const t = await template(q.business_id, "quote_received");
  if (t) {
    await sql`
      insert into messages (business_id, direction, channel, to_email, subject, body, template_trigger, status, dedupe_key)
      values (${q.business_id}, 'out', 'email', ${q.email}, ${render(t.email_subject ?? q.business, vars)}, ${render(t.body, vars)},
              'quote_received', 'queued', ${`quote:${quoteId}:email`})
      on conflict (dedupe_key) do nothing`;
    await sendQueuedEmails(q.business_id);
  }
  const kind = q.kind === "office" ? "Office" : "Airbnb";
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  await notifyOwner(
    q.business_id,
    `New quote request (${kind}): ${q.first_name} ${q.last_name}`,
    `${q.first_name} ${q.last_name}, ${phoneLabel(q.phone)}, ${q.email}${q.city ? `, ${q.city}` : ""}.\n\n${q.message}\n\n` +
      `See it and the photos: ${appUrl}/requests?tab=quotes`,
    "/requests?tab=quotes",
  );
}

/** The text the owner sends by hand from the phone (e.g. "on my way"), filled in. */
export async function smsTextFor(appointmentId: string, trigger: Trigger) {
  const c = await appointmentContext(appointmentId);
  if (!c) return null;
  const t = await template(c.business_id, trigger);
  return t ? render(t.body, varsFor(c)) : null;
}

/** Works out which scheduled messages are due now and queues them. Safe to run often. */
export async function queueDueMessages(businessId: string) {
  const [biz] = await sql<{ timezone: string; on: boolean }[]>`
    select timezone, auto_messages_enabled as on from businesses where id = ${businessId}`;
  if (!biz) return;
  const on = biz.on; // when off, only visits booked online get scheduled messages
  const tz = biz.timezone;
  const today = todayYmd(tz);
  const nowLocal = hm(new Date(), tz);

  // 1. Appointment reminders, N days before, from the set time of day.
  const reminder = await template(businessId, "reminder");
  if (reminder && nowLocal >= (reminder.send_at_time ?? "00:00")) {
    const { start, end } = dayRangeUtc(addDaysYmd(today, reminder.offset_days ?? 1), tz);
    const statuses = reminder.only_if_unconfirmed ? ["unconfirmed"] : ["unconfirmed", "confirmed"];
    const due = await sql<{ id: string }[]>`
      select id from appointments
      where business_id = ${businessId} and start_at >= ${start} and start_at < ${end} and status = any(${statuses})
        and (${on} or source = 'online')`;
    for (const a of due) {
      const c = await appointmentContext(a.id);
      if (c) await enqueue(c, "reminder", reminder, `reminder:${c.id}:${c.start_at.getTime()}`);
    }
  }

  // 2. Rebook reminders: the booked frequency has passed since the last cleaning and nothing
  //    is booked yet (a one-time cleaning: after 4 weeks). Sent on the due date (or up to 3 days late).
  const rebook = on ? await template(businessId, "rebook") : null;
  if (rebook && nowLocal >= (rebook.send_at_time ?? "00:00")) {
    const rows = await sql<{ id: string; start_at: Date; days: number | null }[]>`
      with last as (
        select distinct on (a.client_id) a.client_id, a.id, a.start_at
        from appointments a
        where a.business_id = ${businessId} and a.status = 'completed'
        order by a.client_id, a.start_at desc)
      select last.id, last.start_at,
        (select case a.frequency when 'weekly' then 7 when 'biweekly' then 14 else 28 end
         from appointments a where a.id = last.id) as days
      from last
      where not exists (select 1 from clients c where c.id = last.client_id and c.archived_at is not null)
        and not exists (select 1 from appointments f where f.client_id = last.client_id and f.start_at > now()
                          and f.status in ('requested', 'unconfirmed', 'confirmed'))`;
    for (const r of rows) {
      if (!r.days) continue;
      const dueDate = addDaysYmd(ymd(r.start_at, tz), r.days);
      if (dueDate > today || dueDate < addDaysYmd(today, -3)) continue;
      const c = await appointmentContext(r.id);
      if (c) await enqueue(c, "rebook", rebook, `rebook:${r.id}`, { days: r.days });
    }
  }

  // 3. Abandoned online bookings: one "finish booking" message a while after they stopped
  //    (between 8am and 8pm), and a heads-up to the owner. Part of the online booking flow,
  //    so it goes out even before automatic messages are switched on.
  const abandoned = await template(businessId, "abandoned_booking");
  if (abandoned && nowLocal >= "08:00" && nowLocal < "20:00") await remindAbandoned(businessId, abandoned);

  // 4. Review request, a while after checkout (only when a review link is set).
  const review = await template(businessId, "review_request");
  if (review) {
    const minutes = review.offset_minutes ?? 30;
    const rows = await sql<{ id: string }[]>`
      select a.id from appointments a
      join invoices i on i.appointment_id = a.id and i.status = 'closed'
      join businesses b on b.id = a.business_id
      where a.business_id = ${businessId} and b.review_url is not null and (${on} or a.source = 'online')
        and i.closed_at <= now() - make_interval(mins => ${minutes})
        and i.closed_at > now() - interval '2 days'`;
    for (const r of rows) {
      const c = await appointmentContext(r.id);
      if (c) await enqueue(c, "review_request", review, `review:${r.id}`);
    }
  }
}

const HEADINGS: Partial<Record<Trigger, string>> = {
  request_received: "Your request",
  request_accepted: "You're confirmed!",
  booked: "You're booked!",
  reminder: "Your next visit",
  confirmed: "Confirmed",
  cancelled: "Cancelled visit",
  request_declined: "Your request",
};

/** The appointment card for an email about a visit, or null for messages without one. */
export async function emailDetails(appointmentId: string, trigger: Trigger): Promise<EmailDetails | null> {
  const heading = HEADINGS[trigger];
  if (!heading) return null;
  const [a] = await sql<{ start_at: Date; end_at: Date; status: string; address_line: string | null; public_token: string;
                         timezone: string; phone: string | null; cancellation_hours: number; total: number;
                         lines: { name: string; qty: number; price_cents: number }[] }[]>`
    select a.start_at, a.end_at, a.status, a.address_line, a.public_token, b.timezone, b.phone, b.cancellation_hours,
      coalesce((select sum(l.price_cents) from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
                where ah.appointment_id = a.id), 0)::int as total,
      coalesce((select json_agg(json_build_object('name', l.name, 'qty', l.qty, 'price_cents', l.price_cents) order by l.created_at, l.id)
                from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
                where ah.appointment_id = a.id), '[]'::json) as lines
    from appointments a join businesses b on b.id = a.business_id where a.id = ${appointmentId}`;
  if (!a) return null;
  const live = !["cancelled", "declined", "no_show"].includes(a.status);
  const calendar = ["booked", "request_accepted", "confirmed", "reminder"].includes(trigger) ? await clientEvent({ id: appointmentId }) : null;
  return {
    heading,
    badge:
      trigger === "request_received" || a.status === "requested"
        ? "Waiting for confirmation"
        : ["booked", "reminder"].includes(trigger) && a.status === "unconfirmed"
          ? "Please confirm"
          : null,
    when: `${formatInTimeZone(a.start_at, a.timezone, "EEEE, MMMM d")} · ${formatInTimeZone(a.start_at, a.timezone, "h:mm a")}`,
    address: a.address_line,
    lines: a.lines.map((l) => ({ name: l.qty > 1 ? `${l.name} × ${l.qty}` : l.name, price: money(l.price_cents) })),
    total: a.total ? money(a.total) : "",
    link: live ? appointmentLink(a.public_token) : null,
    businessPhone: phoneLabel(a.phone) || null,
    policy: live
      ? `Free cancellation up to ${a.cancellation_hours} hours before the visit. After that, a late cancellation fee may apply.`
      : null,
    calendar: calendar && { apple: calendar.apple, google: calendar.google, ics: calendar.ics },
  };
}

/** Sends waiting emails. Each row is claimed first, so two runs never send the same email. */
export async function sendQueuedEmails(businessId: string) {
  if (!emailConfigured()) return;
  await sql`update messages set status = 'skipped', error = 'too old to send'
            where business_id = ${businessId} and channel = 'email' and status = 'queued'
              and created_at < now() - interval '2 days'`;
  const rows = await sql<{ id: string; to_email: string; subject: string; body: string; name: string;
                          appointment_id: string | null; template_trigger: Trigger | null }[]>`
    update messages m set status = 'handed_off'
    from businesses b
    where b.id = m.business_id and m.id in (
      select id from messages where business_id = ${businessId} and channel = 'email' and status = 'queued'
      order by created_at limit 50 for update skip locked)
    returning m.id, m.to_email, m.subject, m.body, b.name, m.appointment_id, m.template_trigger`;
  for (const r of rows) {
    try {
      const details = r.appointment_id && r.template_trigger ? await emailDetails(r.appointment_id, r.template_trigger) : null;
      await sendEmail({ to: r.to_email, subject: r.subject, text: r.body, fromName: r.name, details });
      await sql`update messages set status = 'sent', sent_at = now() where id = ${r.id}`;
    } catch (e) {
      await sql`update messages set status = 'failed', error = ${String((e as Error).message).slice(0, 500)} where id = ${r.id}`;
    }
  }
}

/**
 * Hands the waiting SMS to the iPhone Shortcut, which sends them from the owner's number.
 * Texts older than 36 hours are dropped instead (a late reminder is worse than none).
 */
export async function takeSmsOutbox(businessId: string) {
  await sql`update messages set status = 'skipped', error = 'too old to send'
            where business_id = ${businessId} and channel = 'sms' and status = 'queued'
              and created_at < now() - interval '36 hours'`;
  return sql<{ id: string; phone: string; body: string }[]>`
    update messages set status = 'handed_off', sent_at = now()
    where id in (select id from messages where business_id = ${businessId} and channel = 'sms' and status = 'queued'
                 order by created_at limit 40 for update skip locked)
    returning id, to_phone as phone, body`;
}

/** Everything the scheduled jobs do, for every business. */
export async function runMessagingJobs() {
  const businesses = await sql<{ id: string }[]>`select id from businesses`;
  for (const b of businesses) {
    await queueDueMessages(b.id);
    await sendQueuedEmails(b.id);
    await processCampaigns(b.id);
    await monthlyMarketingReminder(b.id);
  }
}

/**
 * Tells the owner something happened (a new online request, a cancellation, a reschedule
 * request): an email to the business email in Settings and a notification on their phone.
 * `url` is the screen the notification opens.
 */
export async function notifyOwner(businessId: string, subject: string, text: string, url?: string) {
  const [b] = await sql<{ email: string | null; name: string }[]>`select email, name from businesses where id = ${businessId}`;
  await Promise.all([
    b?.email && emailConfigured() ? sendEmail({ to: b.email, subject, text, fromName: b.name }).catch(() => {}) : null,
    sendPush(businessId, { title: subject, body: text.split("\n")[0], url }).catch(() => 0),
  ]);
}

/**
 * Once a month (from 9am on the 1st, or the first check after), reminds the owner to send
 * this month's marketing email, with a suggestion. Skipped when one already went out or is
 * scheduled this month, or when the reminder is switched off on the Marketing page.
 */
export async function monthlyMarketingReminder(businessId: string) {
  const [b] = await sql<{ timezone: string; on: boolean; done: string | null }[]>`
    select timezone, marketing_reminder as on, marketing_reminded_month as done from businesses where id = ${businessId}`;
  if (!b?.on) return;
  const today = todayYmd(b.timezone);
  const month = today.slice(0, 7);
  if (b.done === month || hm(new Date(), b.timezone) < "09:00") return;
  const [claimed] = await sql`
    update businesses set marketing_reminded_month = ${month}
    where id = ${businessId} and coalesce(marketing_reminded_month, '') <> ${month} returning id`;
  if (!claimed) return;
  const { start } = dayRangeUtc(`${month}-01`, b.timezone);
  const [already] = await sql`
    select 1 from campaigns where business_id = ${businessId} and (status = 'scheduled' or started_at >= ${start}) limit 1`;
  if (already) return;
  const [pick] = suggestions(today, await lastSentByTemplate(businessId, b.timezone));
  if (!pick) return;
  const when = nextDate(pick, today);
  const on = when ? ` (${formatInTimeZone(new Date(`${when}T12:00:00Z`), "UTC", "EEE, MMM d")})` : "";
  await notifyOwner(
    businessId,
    "Time for this month's email 📬",
    `Suggested: ${pick.name}${on}. Open Marketing, check the text and tap Send. It takes 2 minutes.`,
    "/marketing/new",
  );
}

/** Sends the "finish booking" message for drafts that went quiet. Each draft gets one. */
export async function remindAbandoned(businessId: string, t: Template) {
  const minutes = t.offset_minutes ?? 120;
  const drafts = await sql<{ id: string; phone: string; first_name: string | null; email: string | null; summary: string | null;
                            step: string; client_id: string | null; sms_ok: boolean; business: string; business_phone: string | null }[]>`
    update booking_drafts d set reminded_at = now()
    from businesses b
    where b.id = d.business_id and d.id in (
      select x.id from booking_drafts x
      where x.business_id = ${businessId} and x.completed_at is null and x.reminded_at is null and x.dismissed_at is null
        and x.updated_at < now() - make_interval(mins => ${minutes}) and x.updated_at > now() - interval '3 days'
        -- they may have booked another way since (a text, a call, the owner booked them)
        and not exists (select 1 from appointments a join clients c on c.id = a.client_id
                        where c.business_id = x.business_id and c.phone = x.phone and a.created_at > x.created_at)
      for update skip locked)
    returning d.id, d.phone, d.first_name, d.email, d.summary, d.step, d.client_id, b.name as business, b.phone as business_phone,
      exists (select 1 from clients c where c.id = d.client_id and c.sms_consent_at is not null and c.sms_opted_out_at is null) as sms_ok`;
  for (const d of drafts) {
    const vars = {
      client: d.first_name ?? "there",
      service: d.summary ?? "your cleaning",
      business: d.business,
      business_phone: phoneLabel(d.business_phone),
      booking_url: `${appUrl()}/book?phone=${d.phone.replace(/^\+1/, "")}`,
    };
    const body = render(t.body, vars);
    // Text only to clients who agreed to texts before; everyone else who left an email gets an email.
    if (d.sms_ok) {
      await sql`
        insert into messages (business_id, client_id, direction, channel, to_phone, body, template_trigger, status, dedupe_key)
        values (${businessId}, ${d.client_id}, 'out', 'sms', ${d.phone}, ${body}, 'abandoned_booking', 'queued', ${`abandoned:${d.id}:sms`})
        on conflict (dedupe_key) do nothing`;
    }
    if (d.email) {
      await sql`
        insert into messages (business_id, client_id, direction, channel, to_email, subject, body, template_trigger, status, dedupe_key)
        values (${businessId}, ${d.client_id}, 'out', 'email', ${d.email}, ${render(t.email_subject ?? d.business, vars)}, ${body},
                'abandoned_booking', 'queued', ${`abandoned:${d.id}:email`})
        on conflict (dedupe_key) do nothing`;
    }
    const who = `${d.first_name ?? "Someone"} ${phoneLabel(d.phone)}`;
    const sent = d.sms_ok || d.email ? "We sent them a link to finish." : "They left no email, so give them a call.";
    await notifyOwner(businessId, `Didn't finish booking: ${d.first_name ?? phoneLabel(d.phone)}`,
      `${who} started booking${d.summary ? ` (${d.summary})` : ""} online and stopped (${STEP_LABEL[d.step] ?? d.step}). ${sent}`,
      "/requests");
  }
}

export const STEP_LABEL: Record<string, string> = {
  contact: "after name and email",
  date: "while picking a time",
  address: "after the time, at the address",
  access: "at the access step",
  review: "on the last step",
};
