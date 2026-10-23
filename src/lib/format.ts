import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Parses a dollar amount typed by a person ("45", "45.5", "$1,200.00") into cents. */
export function parseMoney(input: FormDataEntryValue | null): number | null {
  const text = String(input ?? "").replace(/[$,\s]/g, "");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const minutesLabel = (min: number) => {
  if (min === 0) return "no extra time";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m ? `${m}min` : ""].filter(Boolean).join(" ");
};

/** "2026-10-20" + "09:00" in the business time zone -> a UTC Date. */
export const zonedToUtc = (date: string, time: string, tz: string) =>
  fromZonedTime(`${date}T${time}:00`, tz);

export const ymd = (d: Date, tz: string) => formatInTimeZone(d, tz, "yyyy-MM-dd");
export const hm = (d: Date, tz: string) => formatInTimeZone(d, tz, "HH:mm");
export const timeLabel = (d: Date, tz: string) => formatInTimeZone(d, tz, "h:mm a");
export const dayLabel = (d: Date, tz: string) => formatInTimeZone(d, tz, "EEE, MMM d");
export const longDayLabel = (d: Date, tz: string) => formatInTimeZone(d, tz, "EEEE, MMMM d");

/** Today's date (yyyy-MM-dd) in the business time zone. */
export const todayYmd = (tz: string) => ymd(new Date(), tz);

/** Adds days to a yyyy-MM-dd string without time zone surprises. */
export function addDaysYmd(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a yyyy-MM-dd string. */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Start (UTC) of the given local day and of the next one, for range queries. */
export function dayRangeUtc(date: string, tz: string) {
  return { start: zonedToUtc(date, "00:00", tz), end: zonedToUtc(addDaysYmd(date, 1), "00:00", tz) };
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Formats an E.164 US number as (650) 555-0123 for display. */
export function phoneLabel(e164: string | null | undefined) {
  if (!e164) return "";
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** Normalizes a US phone typed in any format to E.164 (+16505550123), or null. */
export function normalizePhone(input: FormDataEntryValue | null): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export const SIZES = [
  { value: "small", label: 'Small (12" or less)' },
  { value: "medium", label: 'Medium (12"–16")' },
  { value: "large", label: 'Large (16"–20")' },
  { value: "xlarge", label: 'X-Large (20" or up)' },
] as const;
export type SizeClass = (typeof SIZES)[number]["value"];
export const sizeLabel = (s: string | null) => SIZES.find((x) => x.value === s)?.label ?? "Size not set";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
