import "server-only";
import { sql } from "../db";
import { sendMany } from "../email";
import { phoneLabel } from "../format";
import { fillVars, marketingEmailHtml, marketingEmailText, type CampaignContent } from "../marketing-email";

// Who a campaign goes to, and sending it in small batches.
// Gmail allows about 500 emails a day per account; campaigns use at most DAILY_LIMIT of
// them (counting the booking emails too), and a bigger list simply finishes the next day.

export const DAILY_LIMIT = 450;

export type Filters = {
  lastVisit: "any" | "over" | "within" | "never"; // last finished visit (or the date imported from the old app)
  days: number;
  upcoming: "any" | "none" | "has"; // a visit already booked
  cities: string[];
  breed: string;
};

export const DEFAULT_FILTERS: Filters = { lastVisit: "any", days: 60, upcoming: "any", cities: [], breed: "" };

export function cleanFilters(raw: unknown): Filters {
  const f = (raw && typeof raw === "object" ? raw : {}) as Partial<Filters>;
  return {
    lastVisit: ["any", "over", "within", "never"].includes(f.lastVisit as string) ? f.lastVisit! : "any",
    days: Number.isInteger(f.days) && f.days! > 0 && f.days! <= 3650 ? f.days! : 60,
    upcoming: ["any", "none", "has"].includes(f.upcoming as string) ? f.upcoming! : "any",
    cities: Array.isArray(f.cities) ? f.cities.map(String).filter(Boolean).slice(0, 50) : [],
    breed: typeof f.breed === "string" ? f.breed.trim().slice(0, 60) : "",
  };
}

export type AudienceRow = { id: string; first_name: string; last_name: string; email: string; pet_name: string | null; last_visit: Date | null };

/** Clients with an email who haven't unsubscribed, narrowed by the filters. */
export function audience(businessId: string, f: Filters) {
  const live = ["requested", "unconfirmed", "confirmed", "en_route"];
  return sql<AudienceRow[]>`
    select * from (
      select c.id, c.first_name, c.last_name, lower(trim(c.email)) as email, c.city,
        (select string_agg(p.name, ' & ' order by p.name) from pets p where p.client_id = c.id and p.deceased_at is null) as pet_name,
        greatest((select max(a.start_at) from appointments a where a.client_id = c.id and a.status = 'completed'),
                 c.imported_last_service_at) as last_visit
      from clients c
      where c.business_id = ${businessId} and c.archived_at is null and c.email_unsubscribed_at is null
        and c.email ~ '^\\S+@\\S+\\.\\S+$'
        ${f.upcoming === "none" ? sql`and not exists (select 1 from appointments a where a.client_id = c.id and a.start_at > now() and a.status = any(${live}))` : sql``}
        ${f.upcoming === "has" ? sql`and exists (select 1 from appointments a where a.client_id = c.id and a.start_at > now() and a.status = any(${live}))` : sql``}
        ${f.cities.length ? sql`and lower(trim(c.city)) = any(${f.cities.map((x) => x.toLowerCase())})` : sql``}
        ${f.breed ? sql`and exists (select 1 from pets p where p.client_id = c.id and p.breed ilike ${"%" + f.breed + "%"})` : sql``}
    ) x
    where true
      ${f.lastVisit === "over" ? sql`and x.last_visit < now() - make_interval(days => ${f.days})` : sql``}
      ${f.lastVisit === "within" ? sql`and x.last_visit >= now() - make_interval(days => ${f.days})` : sql``}
      ${f.lastVisit === "never" ? sql`and x.last_visit is null` : sql``}
    order by x.first_name, x.last_name`;
}

/** The cities clients live in, for the filter. */
export async function clientCities(businessId: string) {
  const rows = await sql<{ city: string; n: number }[]>`
    select initcap(trim(city)) as city, count(*)::int as n from clients
    where business_id = ${businessId} and archived_at is null and coalesce(trim(city), '') <> ''
    group by 1 order by 2 desc, 1 limit 40`;
  return rows;
}

/** Emails this Gmail account can still send today, keeping room under Google's limit. */
export async function emailsLeftToday(businessId: string) {
  const [r] = await sql<{ n: number }[]>`
    select ((select count(*) from messages where business_id = ${businessId} and channel = 'email'
               and status = 'sent' and sent_at > now() - interval '24 hours')
          + (select count(*) from campaign_recipients r join campaigns c on c.id = r.campaign_id
               where c.business_id = ${businessId} and r.status = 'sent' and r.sent_at > now() - interval '24 hours'))::int as n`;
  return Math.max(DAILY_LIMIT - r.n, 0);
}

type Campaign = {
  id: string; business_id: string; subject: string; preheader: string; banner: string | null; headline: string; body: string;
  button_label: string | null; button_url: string | null; filters: unknown; status: string;
};

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Takes the list of recipients (once) and marks the campaign as sending. */
export async function startCampaign(campaignId: string) {
  const [c] = await sql<Campaign[]>`select * from campaigns where id = ${campaignId}`;
  if (!c || (c.status !== "draft" && c.status !== "scheduled")) return;
  const people = await audience(c.business_id, cleanFilters(c.filters));
  await sql.begin(async (tx) => {
    const [ok] = await tx`update campaigns set status = 'sending', started_at = now()
                          where id = ${c.id} and status in ('draft', 'scheduled') returning id`;
    if (!ok) return;
    const seen = new Set<string>();
    for (const p of people) {
      if (seen.has(p.email)) continue; // two clients sharing one email get it once
      seen.add(p.email);
      await tx`insert into campaign_recipients (campaign_id, client_id, email) values (${c.id}, ${p.id}, ${p.email})
               on conflict do nothing`;
    }
  });
}

/** Sends the next few emails of a campaign. Returns how many are still waiting. */
export async function sendCampaignBatch(campaignId: string, max = 8) {
  const [c] = await sql<(Campaign & { name: string; phone: string | null; mailing_address: string | null; website_url: string | null })[]>`
    select c.*, b.name, b.phone, b.mailing_address, b.website_url from campaigns c join businesses b on b.id = c.business_id
    where c.id = ${campaignId}`;
  if (!c || c.status !== "sending") return 0;
  // Emails claimed by a run that never finished (a timeout) go back in the queue.
  await sql`update campaign_recipients set status = 'queued', error = null, sent_at = null
            where campaign_id = ${c.id} and status = 'skipped' and error = 'sending' and sent_at < now() - interval '10 minutes'`;
  const room = Math.min(max, await emailsLeftToday(c.business_id));
  if (room > 0) {
    const batch = await sql<{ id: string; email: string; token: string; first_name: string; pet_name: string | null }[]>`
      update campaign_recipients r set status = 'skipped', error = 'sending', sent_at = now()
      from clients cl
      where cl.id = r.client_id and cl.email_unsubscribed_at is null and r.id in (
        select id from campaign_recipients where campaign_id = ${c.id} and status = 'queued'
        order by email limit ${room} for update skip locked)
      returning r.id, r.email, cl.marketing_token as token, cl.first_name,
        (select string_agg(p.name, ' & ' order by p.name) from pets p where p.client_id = cl.id and p.deceased_at is null) as pet_name`;
    const content: CampaignContent = { preheader: c.preheader, banner: c.banner, headline: c.headline, body: c.body, buttonLabel: c.button_label, buttonUrl: c.button_url };
    // The button goes straight to the booking page: one less click than the website.
    const booking = `${appUrl()}/book`;
    const mails = batch.map((r) => {
      const vars = { first_name: r.first_name, pet_name: r.pet_name ?? "your pup", business: c.name, booking_link: booking };
      const unsubscribeUrl = `${appUrl()}/u/${r.token}`;
      return {
        to: r.email,
        subject: fillVars(c.subject, vars),
        html: marketingEmailHtml({ appUrl: appUrl(), content, vars, phone: phoneLabel(c.phone) || null, mailingAddress: c.mailing_address, unsubscribeUrl }),
        text: marketingEmailText({ content, vars, unsubscribeUrl, mailingAddress: c.mailing_address }),
        // Gmail and Apple Mail show their own "Unsubscribe" button with these.
        headers: { "List-Unsubscribe": `<${appUrl()}/api/unsubscribe/${r.token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    });
    const results = mails.length ? await sendMany(c.name, mails) : [];
    for (const [i, r] of batch.entries()) {
      const error = results[i];
      await sql`update campaign_recipients set status = ${error ? "failed" : "sent"}, error = ${error}, sent_at = ${error ? null : new Date()}
                where id = ${r.id}`;
    }
  }
  const [{ left }] = await sql<{ left: number }[]>`
    select count(*)::int as left from campaign_recipients where campaign_id = ${c.id} and status = 'queued'`;
  if (left === 0) await sql`update campaigns set status = 'sent', finished_at = now() where id = ${c.id} and status = 'sending'`;
  return left;
}

/** Starts scheduled campaigns that are due and keeps sending ones going (scheduled jobs). */
export async function processCampaigns(businessId: string, max = 10) {
  const due = await sql<{ id: string }[]>`
    select id from campaigns where business_id = ${businessId} and status = 'scheduled' and scheduled_at <= now()`;
  for (const d of due) await startCampaign(d.id);
  const sending = await sql<{ id: string }[]>`
    select id from campaigns where business_id = ${businessId} and status = 'sending' order by started_at limit 1`;
  if (sending[0]) await sendCampaignBatch(sending[0].id, max);
}

/** The day each template last went out (yyyy-MM-dd), for suggestions and "sent" labels. */
export async function lastSentByTemplate(businessId: string, timezone: string) {
  const rows = await sql<{ template: string; day: string }[]>`
    select template, to_char(max(started_at) at time zone ${timezone}, 'YYYY-MM-DD') as day from campaigns
    where business_id = ${businessId} and template is not null and status in ('sending', 'sent')
    group by template`;
  return Object.fromEntries(rows.map((r) => [r.template, r.day])) as Record<string, string | undefined>;
}
