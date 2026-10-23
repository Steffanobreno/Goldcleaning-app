import Link from "next/link";
import { weekdayOf } from "@/lib/format";

// Twelve small months. Each working day is colored by how full it is: free, one cleaning
// (a slot left) or full. Tapping a day opens it in the Day view.

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const pad = (n: number) => String(n).padStart(2, "0");
const FILL = ["bg-surface text-ink", "bg-gold-soft text-ink font-semibold", "bg-navy text-white font-semibold"];
const FILL_LABEL = ["free", "1 cleaning, a slot left", "full"];

export function YearView({ year, today, fill, working }: {
  year: number; today: string; fill: Map<string, 1 | 2>; working: (d: string) => boolean;
}) {
  return (
    <section aria-label={`${year}`} className="space-y-3">
      <ul className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted" aria-label="Legend">
        {FILL.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span aria-hidden className={`h-3.5 w-3.5 rounded border border-line ${c}`} /> {FILL_LABEL[i]}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 12 }, (_, m) => {
          const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
          const first = `${year}-${pad(m + 1)}-01`;
          const lead = (weekdayOf(first) + 6) % 7; // weeks start on Monday
          const name = new Date(Date.UTC(year, m, 15)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
          return (
            <div key={m} className="rounded-2xl bg-surface p-2 shadow-[var(--shadow-card)]">
              <Link href={`/calendar?view=month&date=${first}`} className="block px-1 pb-1 text-sm font-bold">{name}</Link>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                {WEEK.map((w, i) => <span key={i} aria-hidden className="text-muted">{w}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                {Array.from({ length: days }, (_, i) => {
                  const d = `${year}-${pad(m + 1)}-${pad(i + 1)}`;
                  const level = fill.get(d) ?? 0;
                  const off = !working(d) && level === 0;
                  return (
                    <Link key={d} href={`/calendar?view=day&date=${d}`}
                      aria-label={`${new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}: ${off ? "day off" : FILL_LABEL[level]}`}
                      className={`flex aspect-square items-center justify-center rounded ${off ? "text-muted/50" : FILL[level]} ${d === today ? "ring-2 ring-gold" : ""}`}>
                      {i + 1}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
