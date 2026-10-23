// Repeating visits ("every 2 weeks", "every month", "after 10 times"): the dates a rule gives.
// Pure functions, used by the repeat form (live list) and the server (to book them).

export type RepeatRule = {
  freq: "day" | "week" | "month";
  every: number; // 1–52
  count: number | null; // how many visits in total, this one included (at most 100)
  until: string | null; // or the last day (yyyy-MM-dd)
};

export const MAX_VISITS = 100;
const MAX_DAYS = 2 * 366; // never more than about two years ahead

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1–12

function step(first: string, rule: RepeatRule, k: number) {
  const [y, m, d] = first.split("-").map(Number);
  if (rule.freq === "month") {
    // Same day of the month; the 31st becomes the last day of shorter months.
    const total = m - 1 + k * rule.every;
    const yy = y + Math.floor(total / 12);
    const mm = (total % 12) + 1;
    return `${yy}-${pad(mm)}-${pad(Math.min(d, daysIn(yy, mm)))}`;
  }
  const t = new Date(Date.UTC(y, m - 1, d + k * rule.every * (rule.freq === "week" ? 7 : 1)));
  return t.toISOString().slice(0, 10);
}

/** Every date of the rule, starting with `first` itself. */
export function repeatDates(first: string, rule: RepeatRule) {
  const limit = Math.min(rule.count ?? MAX_VISITS, MAX_VISITS);
  const last = new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7) - 1, +first.slice(8, 10) + MAX_DAYS)).toISOString().slice(0, 10);
  const end = rule.until && rule.until < last ? rule.until : last;
  const out: string[] = [];
  for (let k = 0; out.length < limit; k++) {
    const d = step(first, rule, k);
    if (d > end) break;
    out.push(d);
  }
  return out;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

/** "Every 2 weeks on Friday, 10 times" */
export function ruleLabel(first: string, rule: RepeatRule) {
  const unit = rule.every === 1 ? rule.freq : `${rule.every} ${rule.freq}s`;
  const on = rule.freq === "week" ? ` on ${WEEKDAYS[new Date(`${first}T12:00:00Z`).getUTCDay()]}`
    : rule.freq === "month" ? ` on day ${Number(first.slice(8))}` : "";
  const ends = rule.count ? `, ${rule.count} times` : rule.until ? `, until ${fmt(rule.until, { month: "short", day: "numeric", year: "numeric" })}` : "";
  return `Every ${unit}${on}${ends}`;
}
