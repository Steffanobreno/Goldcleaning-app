import "server-only";
import { sql } from "./db";
import { addDaysYmd, dayRangeUtc, dayLabel, timeLabel, todayYmd, weekdayOf, zonedToUtc } from "./format";
import { zipInfo, zipMiles } from "./geo/zip";

// Online booking: which times a client may request. Rules, in order:
// 1. the ZIP is in California and within the service radius of the van's start ZIP;
// 2. inside working hours, with at least `min_notice_hours` notice, on the start-time grid (see below);
// 3. not overlapping another visit, keeping `buffer_minutes` free before and after for driving;
// 4. on a day that already has visits, every one of them is within `max_cluster_miles`.
// Days when the van is already close by (NEAR_MILES) are marked, and on them the times right
// before or after the nearby visit are marked "best", so clients pick what keeps the route short.
// Requests hold their time slot until the owner accepts or declines them.

export type PublicBusiness = {
  id: string;
  name: string;
  phone: string | null;
  timezone: string;
  website_url: string | null;
  email: string | null;
  buffer_minutes: number;
  max_cluster_miles: number;
  booking_days_ahead: number;
  min_notice_hours: number;
  slot_minutes: number;
  start_zip: string | null;
  service_radius_miles: number;
  online_booking_enabled: boolean;
  staff_id: string;
};

export async function getPublicBusiness() {
  const [b] = await sql<PublicBusiness[]>`
    select b.id, b.name, b.phone, b.timezone, b.website_url, b.email, b.buffer_minutes,
           b.max_cluster_miles::float8 as max_cluster_miles, b.booking_days_ahead, b.min_notice_hours, b.slot_minutes,
           b.start_zip, b.service_radius_miles::float8 as service_radius_miles, b.online_booking_enabled,
           (select s.id from staff s where s.business_id = b.id and s.active order by (s.role = 'owner') desc, s.created_at limit 1) as staff_id
    from businesses b order by b.created_at limit 1`;
  return b ?? null;
}

export async function onlineServices(businessId: string) {
  return sql<{ id: string; name: string; kind: "service" | "addon"; category: string | null; size_class: string | null;
               description: string | null; duration_min: number; price_cents: number }[]>`
    select id, name, kind, category, size_class, description, duration_min, price_cents
    from services where business_id = ${businessId} and active and online_bookable
    order by kind, sort_order, name`;
}

/** Checks the ZIP against the service area. Returns an error message, or null when fine. */
export function zipProblem(b: PublicBusiness, zip: string) {
  if (!zipInfo(zip)) return "We couldn't find that ZIP code. Please check it, or text us to book.";
  const miles = b.start_zip ? zipMiles(b.start_zip, zip) : null;
  if (miles != null && miles > b.service_radius_miles) {
    return "Sorry, that address is outside our service area. Text us and we'll see what we can do.";
  }
  return null;
}

const ACTIVE = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];

export const NEAR_MILES = 5;

export type DaySlots = {
  date: string;
  label: string;
  near: boolean; // another visit that day is within NEAR_MILES
  times: { value: string; label: string; best?: boolean }[];
};

/** Open start times for a visit of `durationMin` minutes at `zip`, for the coming days. */
export async function findSlots(b: PublicBusiness, zip: string, durationMin: number, onlyDate?: string): Promise<DaySlots[]> {
  const tz = b.timezone;
  const today = todayYmd(tz);
  const firstDay = onlyDate ?? today;
  const days = onlyDate ? 1 : b.booking_days_ahead;
  const rangeStart = dayRangeUtc(firstDay, tz).start;
  const rangeEnd = dayRangeUtc(addDaysYmd(firstDay, days - 1), tz).end;

  const [hours, busy, timeOff] = await Promise.all([
    sql<{ weekday: number; start: string; end: string }[]>`
      select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
      from working_hours where staff_id = ${b.staff_id}`,
    sql<{ start_at: Date; end_at: Date; zip: string | null }[]>`
      select start_at, end_at, zip from appointments
      where business_id = ${b.id} and staff_id = ${b.staff_id} and status = any(${ACTIVE})
        and start_at < ${rangeEnd} and end_at > ${rangeStart}`,
    sql<{ start_at: Date; end_at: Date }[]>`
      select start_at, end_at from time_off where staff_id = ${b.staff_id} and start_at < ${rangeEnd} and end_at > ${rangeStart}`,
  ]);

  const earliest = Date.now() + b.min_notice_hours * 3600_000;
  const buffer = b.buffer_minutes * 60_000;
  const length = Math.max(durationMin, 15) * 60_000;
  const step = b.slot_minutes * 60_000;
  const result: DaySlots[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(firstDay, i);
    if (date < today) continue;
    const h = hours.find((x) => x.weekday === weekdayOf(date));
    if (!h) continue;
    const { start: dayStart, end: dayEnd } = dayRangeUtc(date, tz);
    const sameDay = busy.filter((a) => a.start_at < dayEnd && a.end_at > dayStart);
    // Rule 4: keep the day's stops close together.
    if (sameDay.some((a) => { const m = zipMiles(zip, a.zip); return m != null && m > b.max_cluster_miles; })) continue;

    const open = zonedToUtc(date, h.start, tz).getTime();
    const close = zonedToUtc(date, h.end, tz).getTime();
    // Start times are the opening time and the end of every visit already booked, then
    // every `slot_minutes` (2 hours: 7, 9, 11…; after a 3-hour dog from 7, it's 10, 12, 14…),
    // as long as the whole visit fits before the next booking and closing time. Long visits
    // use the same grid: 6 hours can start at 7, 9, 11 or 1 when the day closes at 7.
    const clashes = (t: number) =>
      sameDay.some((a) => t < a.end_at.getTime() + buffer && t + length + buffer > a.start_at.getTime()) ||
      timeOff.some((o) => t < o.end_at.getTime() && t + length > o.start_at.getTime());
    const anchors = [open, ...sameDay.map((a) => a.end_at.getTime() + buffer), ...timeOff.map((o) => o.end_at.getTime())]
      .filter((t) => t >= open && t < close);
    const starts = new Set<number>();
    for (const anchor of anchors) {
      for (let t = anchor; t + length <= close && !clashes(t); t += step) {
        if (t >= earliest) starts.add(t);
      }
    }
    const sorted = [...starts].sort((x, y) => x - y);
    // The closest visit that day; the first start after it and the last one that ends before it.
    const closest = sameDay
      .map((a) => ({ a, m: zipMiles(zip, a.zip) }))
      .filter((x): x is { a: (typeof sameDay)[number]; m: number } => x.m != null && x.m <= NEAR_MILES)
      .sort((x, y) => x.m - y.m)[0]?.a;
    const best = new Set<number>();
    if (closest) {
      const after = sorted.find((t) => t >= closest.end_at.getTime() + buffer);
      const before = sorted.filter((t) => t + length + buffer <= closest.start_at.getTime()).at(-1);
      if (after != null) best.add(after);
      if (before != null) best.add(before);
    }
    const times: DaySlots["times"] = sorted.map((t) => {
      const d = new Date(t);
      return { value: d.toISOString(), label: timeLabel(d, tz), ...(best.has(t) ? { best: true } : {}) };
    });
    if (times.length) result.push({ date, label: dayLabel(zonedToUtc(date, "12:00", tz), tz), near: !!closest, times });
  }
  return result;
}
