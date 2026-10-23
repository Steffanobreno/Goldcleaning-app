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
                         pets: string | null; detail: string | null }[]>`
    select a.id, a.start_at, a.end_at, a.updated_at, a.status, a.address_line, a.zip, a.public_token,
           b.name as business, b.phone, b.timezone,
           (select string_agg(p.name, ' & ' order by p.name) from appointment_pets ap join pets p on p.id = ap.pet_id
             where ap.appointment_id = a.id) as pets,
           (select string_agg(p.name || ': ' || coalesce((select string_agg(s.name, ', ' order by s.created_at)
                     from appointment_services s where s.appointment_pet_id = ap.id), ''), E'\n' order by p.name)
             from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = a.id) as detail
    from appointments a join businesses b on b.id = a.business_id
    where (${id}::uuid is not null and a.id = ${id}) or (${token}::text is not null and a.public_token = ${token})
    limit 1`;
  if (!a || !ADDABLE.includes(a.status)) return null;
  const link = `${appUrl()}/a/${a.public_token}`;
  const event: IcsEvent = {
    uid: `${a.id}@woofers`,
    start: a.start_at,
    end: a.end_at,
    updated: a.updated_at,
    title: `${a.pets ? `${a.pets}'s grooming` : "Dog grooming"} · ${a.business}`,
    location: [a.address_line, a.zip].filter(Boolean).join(" ") || null,
    description: [
      a.detail,
      `See, confirm or cancel: ${link}`,
      a.phone ? `Questions? Text us at ${phoneLabel(a.phone)}.` : null,
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
