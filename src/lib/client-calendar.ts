import "server-only";
import { sql } from "./db";
import { phoneLabel } from "./format";
import { googleCalendarLink, icsCalendar, icsEventLines, type IcsEvent } from "./ics";

// The visit as an event for the client's own calendar (iPhone, Google, Outlook): sent with
// the booking, confirmation and reminder emails, and downloadable from their appointment link.

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Visits the client can add to a calendar: booked and not yet over or cancelled. */
const ADDABLE = ["unconfirmed", "confirmed", "en_route"];

export async function clientEvent(by: { id: string } | { token: string }) {
  const id = "id" in by ? by.id : null;
  const token = "token" in by ? by.token : null;
  const [a] = await sql<{ id: string; start_at: Date; end_at: Date; updated_at: Date; status: string; address_line: string | null;
                         zip: string | null; public_token: string; business: string; phone: string | null; timezone: string;
                         service: string | null; detail: string | null }[]>`
    select a.id, a.start_at, a.end_at, a.updated_at, a.status, a.address_line, a.zip, a.public_token,
           b.name as business, b.phone, b.timezone,
           (select sv.name from services sv where sv.id = a.service_id) as service,
           (select string_agg(l.name || case when l.qty > 1 then ' × ' || l.qty else '' end, E'\n' order by l.created_at, l.id)
             from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
             where ah.appointment_id = a.id and l.kind in ('service', 'extra')) as detail
    from appointments a join businesses b on b.id = a.business_id
    where (${id}::uuid is not null and a.id = ${id}) or (${token}::text is not null and a.public_token = ${token})
    limit 1`;
  if (!a || !ADDABLE.includes(a.status)) return null;
  const link = `${appUrl()}/a/${a.public_token}`;
  const event: IcsEvent = {
    uid: `${a.id}@goldcleaning`,
    start: a.start_at,
    end: a.end_at,
    updated: a.updated_at,
    title: `${a.service ?? "House cleaning"} · ${a.business}`,
    location: [a.address_line, a.zip].filter(Boolean).join(" ") || null,
    description: [
      a.detail,
      `See, confirm or cancel: ${link}`,
      a.phone ? `Questions? Call or text us at ${phoneLabel(a.phone)}.` : null,
    ].filter(Boolean).join("\n\n"),
    url: link,
    alarmsMinutesBefore: [24 * 60, 60],
  };
  return {
    token: a.public_token,
    ics: icsCalendar(a.business, a.timezone, [icsEventLines(event)]),
    google: googleCalendarLink(event),
    apple: `${link}/calendar`,
  };
}
