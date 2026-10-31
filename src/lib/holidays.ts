// US holidays by year. The owner picks which ones the business closes for (businesses.closed_holidays).

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The nth weekday of a month (n = -1 for the last one). weekday: 0 = Sunday. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return lastDay - ((last - weekday + 7) % 7);
}

/** Easter Sunday (Gregorian), "Anonymous" algorithm. */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return { month, day: ((h + l - 7 * m + 114) % 31) + 1 };
}

export const HOLIDAYS: { key: string; name: string; date: (y: number) => string }[] = [
  { key: "new_year", name: "New Year's Day", date: (y) => ymdOf(y, 1, 1) },
  { key: "mlk", name: "Martin Luther King Jr. Day", date: (y) => ymdOf(y, 1, nthWeekday(y, 1, 1, 3)) },
  { key: "valentines", name: "Valentine's Day", date: (y) => ymdOf(y, 2, 14) },
  { key: "presidents", name: "Presidents' Day", date: (y) => ymdOf(y, 2, nthWeekday(y, 2, 1, 3)) },
  { key: "easter", name: "Easter Sunday", date: (y) => { const e = easter(y); return ymdOf(y, e.month, e.day); } },
  { key: "mothers", name: "Mother's Day", date: (y) => ymdOf(y, 5, nthWeekday(y, 5, 0, 2)) },
  { key: "memorial", name: "Memorial Day", date: (y) => ymdOf(y, 5, nthWeekday(y, 5, 1, -1)) },
  { key: "juneteenth", name: "Juneteenth", date: (y) => ymdOf(y, 6, 19) },
  { key: "fathers", name: "Father's Day", date: (y) => ymdOf(y, 6, nthWeekday(y, 6, 0, 3)) },
  { key: "independence", name: "Independence Day", date: (y) => ymdOf(y, 7, 4) },
  { key: "labor", name: "Labor Day", date: (y) => ymdOf(y, 9, nthWeekday(y, 9, 1, 1)) },
  { key: "columbus", name: "Columbus Day", date: (y) => ymdOf(y, 10, nthWeekday(y, 10, 1, 2)) },
  { key: "halloween", name: "Halloween", date: (y) => ymdOf(y, 10, 31) },
  { key: "veterans", name: "Veterans Day", date: (y) => ymdOf(y, 11, 11) },
  { key: "thanksgiving", name: "Thanksgiving Day", date: (y) => ymdOf(y, 11, nthWeekday(y, 11, 4, 4)) },
  { key: "black_friday", name: "Day after Thanksgiving", date: (y) => ymdOf(y, 11, nthWeekday(y, 11, 4, 4) + 1) },
  { key: "christmas_eve", name: "Christmas Eve", date: (y) => ymdOf(y, 12, 24) },
  { key: "christmas", name: "Christmas Day", date: (y) => ymdOf(y, 12, 25) },
  { key: "new_years_eve", name: "New Year's Eve", date: (y) => ymdOf(y, 12, 31) },
];

/** The closed holiday on this day, if any. */
export function closedHoliday(date: string, closed: string[]) {
  const y = Number(date.slice(0, 4));
  return HOLIDAYS.find((h) => closed.includes(h.key) && h.date(y) === date) ?? null;
}
