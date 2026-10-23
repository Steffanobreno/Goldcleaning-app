import "server-only";
import { sql } from "./db";
import { addDaysYmd, dayRangeUtc, todayYmd } from "./format";
import { serviceAreaProblem } from "./service-area";
import { openSlots, type DaySlots, type SlotDef } from "./slots";

// Online booking: which times a client may request. One team, fixed start times per weekday
// (`booking_slots`), at least `min_notice_hours` ahead, up to `booking_days_ahead` days, and the
// whole visit must fit without touching another active visit (requests hold their time until the
// owner accepts or declines them) or time off. The ZIP's city must be one of `service_cities`.

export type { DaySlots };

export type PublicBusiness = {
  id: string;
  name: string;
  phone: string | null;
  timezone: string;
  website_url: string | null;
  email: string | null;
  booking_days_ahead: number;
  min_notice_hours: number;
  service_cities: string[];
  online_booking_enabled: boolean;
  staff_id: string;
};

export async function getPublicBusiness() {
  const [b] = await sql<PublicBusiness[]>`
    select b.id, b.name, b.phone, b.timezone, b.website_url, b.email, b.booking_days_ahead, b.min_notice_hours,
           b.service_cities, b.online_booking_enabled,
           (select s.id from staff s where s.business_id = b.id and s.active order by (s.role = 'owner') desc, s.created_at limit 1) as staff_id
    from businesses b order by b.created_at limit 1`;
  return b ?? null;
}

/** Checks the ZIP against the service area. Returns an error message, or null when fine. */
export function zipProblem(b: PublicBusiness, zip: string) {
  return serviceAreaProblem(zip, b.service_cities);
}

const ACTIVE = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];

/** Open start times for a visit of `durationMin` minutes, for the coming days (or one day). */
export async function findSlots(b: PublicBusiness, durationMin: number, onlyDate?: string): Promise<DaySlots[]> {
  const tz = b.timezone;
  const today = todayYmd(tz);
  const firstDay = onlyDate && onlyDate > today ? onlyDate : today;
  const days = onlyDate ? 1 : b.booking_days_ahead;
  const rangeStart = dayRangeUtc(firstDay, tz).start;
  const rangeEnd = dayRangeUtc(addDaysYmd(firstDay, days - 1), tz).end;

  const [slots, busy, timeOff] = await Promise.all([
    sql<SlotDef[]>`
      select weekday, to_char(start_time, 'HH24:MI') as start, label from booking_slots where business_id = ${b.id}`,
    sql<{ start_at: Date; end_at: Date }[]>`
      select start_at, end_at from appointments
      where business_id = ${b.id} and status = any(${ACTIVE}) and start_at < ${rangeEnd} and end_at > ${rangeStart}`,
    sql<{ start_at: Date; end_at: Date }[]>`
      select start_at, end_at from time_off where staff_id = ${b.staff_id} and start_at < ${rangeEnd} and end_at > ${rangeStart}`,
  ]);
  return openSlots({
    firstDay,
    days,
    tz,
    slots,
    durationMin,
    busy: [...busy, ...timeOff].map((x) => ({ start: x.start_at, end: x.end_at })),
    earliest: new Date(Date.now() + b.min_notice_hours * 3600_000),
  });
}
