import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { addDaysYmd, dayRangeUtc, hm, isUuid, ymd } from "../format";

export type TimeOff = { id: string; start_at: Date; end_at: Date; reason: string | null; series_id: string | null; staff_id?: string };

/** Blocks that touch the days from `from`, `count` days long: one groomer's, or everyone's (null). */
export function listTimeOff(staff: StaffContext, from: string, count: number, groomer: string | null = staff.staffId) {
  const start = dayRangeUtc(from, staff.timezone).start;
  const end = dayRangeUtc(addDaysYmd(from, count - 1), staff.timezone).end;
  return sql<TimeOff[]>`
    select t.id, t.start_at, t.end_at, t.reason, t.series_id, t.staff_id from time_off t join staff s on s.id = t.staff_id
    where s.business_id = ${staff.businessId} and (${groomer}::uuid is null or t.staff_id = ${groomer})
      and t.start_at < ${end} and t.end_at > ${start}
    order by t.start_at`;
}

export async function getTimeOff(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await sql<TimeOff[]>`
    select t.id, t.start_at, t.end_at, t.reason, t.series_id, t.staff_id from time_off t join staff s on s.id = t.staff_id
    where t.id = ${id} and s.business_id = ${staff.businessId}`;
  return row ?? null;
}

/** A block from midnight to midnight (or longer) is shown as "All day". */
export const isAllDay = (t: { start_at: Date; end_at: Date }, tz: string) =>
  hm(t.start_at, tz) === "00:00" && hm(t.end_at, tz) === "00:00" && ymd(t.end_at, tz) > ymd(t.start_at, tz);
