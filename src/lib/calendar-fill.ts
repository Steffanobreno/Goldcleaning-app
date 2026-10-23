// How full each day is, for the calendar's Year view: one cleaning books half the day (the
// morning or the afternoon slot), two fill it. Cancelled, declined and no-show visits don't count.
import { ymd } from "./format";

const INACTIVE = ["cancelled", "declined", "no_show", "waitlist"];

/** yyyy-MM-dd (business time zone) → 1 (one cleaning) or 2 (full); free days are absent. */
export function dayFill(appointments: { start_at: Date; status: string }[], tz: string): Map<string, 1 | 2> {
  const count = new Map<string, number>();
  for (const a of appointments) {
    if (INACTIVE.includes(a.status)) continue;
    const d = ymd(a.start_at, tz);
    count.set(d, (count.get(d) ?? 0) + 1);
  }
  return new Map([...count].map(([d, n]) => [d, n >= 2 ? 2 : 1]));
}
