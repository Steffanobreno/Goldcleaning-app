import { addDaysYmd, isYmd, weekdayOf } from "./format";
import type { Group } from "./data/reports";

// The Reports period, from the page's query (?period=… or ?from=…&to=…, and ?group=), shared by the
// page and its PDF/CSV export so both always cover the same days.

export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last30", label: "Last 30 days" },
  { key: "year", label: "This year" },
] as const;

/** First and last day (yyyy-MM-dd) of a preset period around `today`. */
export function presetRange(key: string, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  const lastOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  switch (key) {
    case "week": {
      const monday = addDaysYmd(today, -((weekdayOf(today) + 6) % 7));
      return [monday, addDaysYmd(monday, 6)];
    }
    case "month":
      return [`${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-${String(lastOfMonth).padStart(2, "0")}`];
    case "last30":
      return [addDaysYmd(today, -29), today];
    case "year":
      return [`${y}-01-01`, `${y}-12-31`];
    default:
      return [today, today];
  }
}

const utc = (d: string) => new Date(`${d}T12:00:00Z`);
export const periodDays = (from: string, to: string) => Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000) + 1;

type Query = Record<string, string | string[] | undefined>;

/** The days, the preset (or "custom"), the grouping and the query that names them. */
export function reportPeriod(sp: Query, today: string) {
  const custom = isYmd(sp.from) && isYmd(sp.to) && (sp.from as string) <= (sp.to as string);
  const period = custom ? "custom" : PERIODS.some((p) => p.key === sp.period) ? String(sp.period) : "month";
  const [from, to] = custom ? [sp.from as string, sp.to as string] : presetRange(period, today);
  const length = periodDays(from, to);
  const group: Group = sp.group === "day" || sp.group === "week" || sp.group === "month"
    ? sp.group : length <= 31 ? "day" : length <= 120 ? "week" : "month";
  const rangeQuery = custom ? `from=${from}&to=${to}` : `period=${period}`;
  return { from, to, period, length, group, rangeQuery };
}
