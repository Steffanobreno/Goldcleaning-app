import "server-only";
import { sql } from "../db";
import { closedHoliday } from "../holidays";

export type ClosedDate = { id: string; start_date: string; end_date: string; reason: string | null };

export async function listClosedDates(businessId: string) {
  return sql<ClosedDate[]>`
    select id, start_date::text, end_date::text, reason from closed_dates
    where business_id = ${businessId} and end_date >= current_date - 30
    order by start_date`;
}

/**
 * Why the business is closed on each day from..to (inclusive), as a map date → reason.
 * Days not in the map are open (working hours still apply).
 */
export async function closedDays(businessId: string, from: string, to: string) {
  const [[b], ranges] = await Promise.all([
    sql<{ closed_holidays: string[] }[]>`select closed_holidays from businesses where id = ${businessId}`,
    sql<{ start_date: string; end_date: string; reason: string | null }[]>`
      select start_date::text, end_date::text, reason from closed_dates
      where business_id = ${businessId} and start_date <= ${to} and end_date >= ${from}`,
  ]);
  const out = new Map<string, string>();
  for (let d = from; d <= to; d = nextDay(d)) {
    const range = ranges.find((r) => r.start_date <= d && r.end_date >= d);
    const holiday = closedHoliday(d, b?.closed_holidays ?? []);
    if (range) out.set(d, range.reason || "Closed");
    else if (holiday) out.set(d, holiday.name);
  }
  return out;
}

const nextDay = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};
