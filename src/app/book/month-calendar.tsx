"use client";
import { useState } from "react";
import type { DaySlots } from "@/lib/booking";
import { ChevronLeft, ChevronRight } from "@/components/icons";

// A month grid. Days with open times are tappable and show green dots (two for a day with
// plenty of room, one when only a time or two is left); other days are greyed out.
// Dates are yyyy-MM-dd strings in the business time zone, so all math here is in UTC.

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const monthOf = (ymd: string) => ymd.slice(0, 7);
const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shiftMonth = (ym: string, by: number) => {
  const d = new Date(`${ym}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};

export function MonthCalendar({
  days,
  today,
  selected,
  onSelect,
}: {
  days: DaySlots[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const open = new Map(days.map((d) => [d.date, d.times.length]));
  const first = days[0]?.date ?? today;
  const last = days.at(-1)?.date ?? today;
  const [month, setMonth] = useState(monthOf(selected ?? first));

  const start = new Date(`${month}-01T12:00:00Z`);
  const lead = start.getUTCDay();
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  const navButton = "flex h-10 w-10 items-center justify-center rounded-full border border-line disabled:opacity-30";
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold" aria-live="polite">{monthName(month)}</h3>
        <div className="flex items-center gap-2">
          <button type="button" className={navButton} aria-label="Previous month" disabled={month <= monthOf(today)} onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </button>
          <button type="button" className={navButton} aria-label="Next month" disabled={month >= monthOf(last)} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center" role="group" aria-label={monthName(month)}>
        {WEEK.map((w, i) => (
          <span key={i} className="pb-1 text-xs font-semibold text-muted" aria-hidden>
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={i} />;
          const n = open.get(date) ?? 0;
          const isSelected = date === selected;
          const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
          return (
            <div key={date} className="flex justify-center">
              <button
                type="button"
                disabled={!n}
                aria-pressed={isSelected}
                aria-label={n ? `${label}, ${n} open ${n === 1 ? "time" : "times"}` : `${label}, no open times`}
                onClick={() => onSelect(date)}
                className={`flex h-12 w-12 flex-col items-center justify-center rounded-full text-[15px] font-semibold transition-colors ${
                  isSelected
                    ? "bg-brand text-on-brand shadow-md"
                    : n
                      ? "border border-line hover:border-brand"
                      : "text-muted/50"
                } ${date === today && !isSelected ? "ring-2 ring-sky/40" : ""}`}
              >
                {Number(date.slice(8))}
                <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                  {n > 0 &&
                    Array.from({ length: n > 2 ? 2 : 1 }, (_, k) => (
                      <span key={k} className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-success"}`} />
                    ))}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
