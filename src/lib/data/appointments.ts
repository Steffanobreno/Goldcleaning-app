import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { dayRangeUtc, addDaysYmd, hm, isUuid, ymd } from "../format";
import { zipMiles } from "../geo/zip";
import type { Frequency } from "../pricing";
import { homeSizeLabel } from "../home-options";

export type ApptHome = {
  id: string;
  label: string;
  bedrooms: number;
  full_baths: number;
  half_baths: number;
  access_method: string | null;
  access_code: string | null;
  parking_notes: string | null;
  pets_in_home: string | null;
  product_preferences: string | null;
  notes: string | null;
};

// The visit's home (one per visit) as JSON, for the selects below.
const homeJson = sql`
  (select json_build_object('id', h.id, 'label', h.label, 'bedrooms', h.bedrooms, 'full_baths', h.full_baths,
            'half_baths', h.half_baths, 'access_method', h.access_method, 'access_code', h.access_code,
            'parking_notes', h.parking_notes, 'pets_in_home', h.pets_in_home,
            'product_preferences', h.product_preferences, 'notes', h.notes)
   from appointment_homes ah join homes h on h.id = ah.home_id
   where ah.appointment_id = a.id order by ah.created_at limit 1)`;
const totalSql = sql`
  coalesce((select sum(l.price_cents) from appointment_homes ah
            join appointment_lines l on l.appointment_home_id = ah.id
            where ah.appointment_id = a.id), 0)::int`;

export type AppointmentListItem = {
  id: string;
  start_at: Date;
  end_at: Date;
  status: string;
  notes: string | null;
  address_line: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  client_id: string;
  client_name: string;
  client_phone: string;
  city: string | null;
  access_notes: string | null;
  home: ApptHome | null;
  service_name: string | null;
  frequency: Frequency;
  total_cents: number;
  paid: boolean;
  series_id: string | null;
  staff_id: string;
  staff_name: string;
  staff_color: string;
};

const listSelect = (staff: StaffContext, start: Date, end: Date) => sql<AppointmentListItem[]>`
  select a.id, a.start_at, a.end_at, a.status, a.notes, a.address_line, a.zip, a.lat, a.lng, a.series_id,
         a.staff_id, st.name as staff_name, st.color as staff_color,
         c.id as client_id, trim(c.first_name || ' ' || c.last_name) as client_name,
         c.phone as client_phone, c.city, c.access_notes,
         ${homeJson} as home, sv.name as service_name, a.frequency,
         ${totalSql} as total_cents,
         exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid
  from appointments a
  join clients c on c.id = a.client_id
  join staff st on st.id = a.staff_id
  left join services sv on sv.id = a.service_id
  where a.business_id = ${staff.businessId}
    and a.start_at >= ${start} and a.start_at < ${end}
    and a.status not in ('declined', 'waitlist')
  order by a.start_at`;

export function listDay(staff: StaffContext, date: string) {
  const { start, end } = dayRangeUtc(date, staff.timezone);
  return listSelect(staff, start, end);
}

export function listRange(staff: StaffContext, fromDate: string, days: number) {
  return listSelect(
    staff,
    dayRangeUtc(fromDate, staff.timezone).start,
    dayRangeUtc(addDaysYmd(fromDate, days - 1), staff.timezone).end,
  );
}

export type AppointmentDetail = {
  id: string;
  start_at: Date;
  end_at: Date;
  status: string;
  notes: string | null;
  address_line: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  series_id: string | null;
  staff_id: string;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
  reschedule_requested_at: Date | null;
  reschedule_note: string | null;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    city: string | null;
    state: string | null;
    access_notes: string | null;
    sms_opted_out_at: string | null;
  };
  service_id: string | null;
  service_name: string | null;
  frequency: Frequency;
  appointment_home_id: string | null;
  home: ApptHome | null;
  lines: { id: string; service_id: string | null; kind: "service" | "room" | "extra" | "adjustment"; name: string; qty: number; price_cents: number }[];
  total_cents: number;
};

export async function getAppointment(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await sql<AppointmentDetail[]>`
    select a.id, a.start_at, a.end_at, a.status, a.notes, a.address_line, a.zip, a.lat, a.lng, a.series_id,
      a.staff_id, a.checked_in_at, a.checked_out_at, a.reschedule_requested_at, a.reschedule_note,
      a.service_id, sv.name as service_name, a.frequency,
      (select ah.id from appointment_homes ah where ah.appointment_id = a.id order by ah.created_at limit 1) as appointment_home_id,
      ${homeJson} as home, ${totalSql} as total_cents,
      coalesce((select json_agg(json_build_object('id', l.id, 'service_id', l.service_id, 'kind', l.kind, 'name', l.name,
                                                  'qty', l.qty, 'price_cents', l.price_cents) order by l.created_at)
                from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
                where ah.appointment_id = a.id), '[]'::json) as lines,
      json_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'phone', c.phone, 'email', c.email,
                        'city', c.city, 'state', c.state, 'access_notes', c.access_notes,
                        'sms_opted_out_at', c.sms_opted_out_at) as client
    from appointments a join clients c on c.id = a.client_id
    left join services sv on sv.id = a.service_id
    where a.id = ${id} and a.business_id = ${staff.businessId}`;
  return row ?? null;
}

/** Working hours for the business owner on a weekday, or null if that day is off. */
export async function workingHoursFor(staff: StaffContext, weekday: number) {
  const [row] = await sql<{ start_time: string; end_time: string }[]>`
    select start_time::text, end_time::text from working_hours
    where staff_id = ${staff.staffId} and weekday = ${weekday}
    order by start_time limit 1`;
  return row ?? null;
}

/**
 * The coming days when this groomer already has a visit close to `zip`, closest first:
 * where to put a new visit so the route stays short. `after` is when the nearby visit ends,
 * rounded up to the next quarter hour.
 */
export async function nearbyDays(staff: StaffContext, zip: string | null, limit = 4) {
  if (!zip) return [];
  const rows = await sql<{ start_at: Date; end_at: Date; zip: string | null; first_name: string }[]>`
    select a.start_at, a.end_at, a.zip, c.first_name from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.staff_id = ${staff.staffId}
      and a.start_at > now() and a.start_at < now() + interval '45 days' and a.zip is not null
      and a.status in ('requested', 'unconfirmed', 'confirmed')`;
  const best = new Map<string, { date: string; miles: number; name: string; after: string }>();
  for (const r of rows) {
    const miles = zipMiles(zip, r.zip);
    if (miles == null || miles > 25) continue;
    const date = ymd(r.start_at, staff.timezone);
    const end = hm(new Date(Math.ceil(r.end_at.getTime() / 900_000) * 900_000), staff.timezone);
    const prev = best.get(date);
    if (!prev || miles < prev.miles) best.set(date, { date, miles, name: r.first_name, after: end });
  }
  return [...best.values()].sort((a, b) => a.miles - b.miles || a.date.localeCompare(b.date)).slice(0, limit);
}

/** "Regular Clean · 3 bd / 2 ba", for lists and the calendar. */
export const visitLabel = (a: { service_name: string | null; home: ApptHome | null }) =>
  [a.service_name, a.home ? homeSizeLabel(a.home) : null].filter(Boolean).join(" · ");
