import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listRange, type AppointmentListItem } from "@/lib/data/appointments";
import { listTimeOff, type TimeOff } from "@/lib/data/time-off";
import { sql } from "@/lib/db";
import { addDaysYmd, dayLabel, dayRangeUtc, hm, isYmd, money, timeLabel, todayYmd, weekdayOf, ymd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Page, PageHeader, StatusBadge } from "@/components/ui";
import { DayNav } from "@/components/day-nav";
import { SlotButton } from "./slot-button";
import { GroomerFilter } from "@/components/groomer-filter";
import { listGroomers } from "@/lib/data/staff";

export const metadata: Metadata = { title: "Calendar" };

// Four ways to look at the schedule, like a phone calendar:
// Day (hour by hour), Week (seven columns), Month (grid of days) and Agenda (list).

type View = "day" | "week" | "month" | "agenda";
const VIEWS: { key: View; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "agenda", label: "Agenda" },
];
const HIDDEN = ["cancelled", "no_show"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const monday = (d: string) => addDaysYmd(d, -((weekdayOf(d) + 6) % 7));
const utcNoon = (d: string) => new Date(`${d}T12:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => utcNoon(d).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

// Card colors by status (left bar), so the day reads at a glance.
// Blocked time is grey with stripes, so it never reads as a visit.
const BLOCK_STYLE = "bg-[repeating-linear-gradient(135deg,var(--color-bg)_0_6px,var(--color-line)_6px_8px)] text-muted";

/** The minutes of day `d` a block covers (0–1440), or null when it doesn't touch that day. */
function clip(t: TimeOff, d: string, tz: string) {
  const { start, end } = dayRangeUtc(d, tz);
  if (t.start_at >= end || t.end_at <= start) return null;
  return {
    s: t.start_at <= start ? 0 : toMin(hm(t.start_at, tz)),
    e: t.end_at >= end ? 1440 : toMin(hm(t.end_at, tz)),
  };
}
const blockTitle = (t: TimeOff) => t.reason || "Blocked";

const STATUS_BAR: Record<string, string> = {
  requested: "border-l-warn",
  unconfirmed: "border-l-danger",
  confirmed: "border-l-brand",
  en_route: "border-l-sky",
  in_progress: "border-l-success",
  completed: "border-l-success",
};

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const date = isYmd(sp.date) ? sp.date : today;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "day";

  // The range each view needs.
  const monthStart = `${date.slice(0, 7)}-01`;
  const gridStart = monday(monthStart);
  const [y, m] = date.split("-").map(Number);
  const monthEnd = `${date.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const gridDays = Math.ceil((Math.round((utcNoon(monthEnd).getTime() - utcNoon(gridStart).getTime()) / 86_400_000) + 1) / 7) * 7;
  const [from, count] =
    view === "day" ? [date, 1] : view === "month" ? [gridStart, gridDays] : [monday(date), 7];

  // ?groomer= shows one groomer's visits and blocks; without it, everyone's.
  const groomer = typeof sp.groomer === "string" && /^[0-9a-f-]{36}$/.test(sp.groomer) ? sp.groomer : null;
  const [all, blocks, hours, groomers] = await Promise.all([
    listRange(staff, from, count),
    listTimeOff(staff, from, count, groomer),
    sql<{ weekday: number; start: string; end: string }[]>`
      select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
      from working_hours where staff_id = ${groomer ?? staff.staffId}`,
    listGroomers(staff, { activeOnly: true }),
  ]);
  const appts = groomer ? all.filter((a) => a.staff_id === groomer) : all;
  const multi = groomers.length > 1;
  const q = groomer ? `&groomer=${groomer}` : "";
  const hoursOf = (d: string) => hours.find((h) => h.weekday === weekdayOf(d)) ?? null;
  const onDay = (d: string) => appts.filter((a) => ymd(a.start_at, tz) === d);
  const blocksOn = (d: string) => blocks.filter((t) => clip(t, d, tz));

  const step = view === "day" ? 1 : view === "month" ? null : 7;
  const shift = (n: number) => {
    if (step) return addDaysYmd(date, n * step);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return d.toISOString().slice(0, 10);
  };
  const label =
    view === "day" ? dayLabel(zonedToUtc(date, "12:00", tz), tz)
      : view === "month" ? fmt(date, { month: "long", year: "numeric" })
        : `${fmt(monday(date), { month: "short", day: "numeric" })} – ${fmt(addDaysYmd(monday(date), 6), { month: "short", day: "numeric" })}`;
  const base = `/calendar?view=${view}${q}&`;

  return (
    <>
      <PageHeader title="Calendar" action={<ButtonLink href={`/appointments/new?date=${date}`}>Book</ButtonLink>} />
      <Page>
        <nav aria-label="View" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1 shadow-[var(--shadow-card)]">
          {VIEWS.map((v) => (
            <Link key={v.key} href={`/calendar?view=${v.key}&date=${date}${q}`} aria-current={v.key === view ? "page" : undefined}
              className={`rounded-xl py-2 text-center text-sm font-semibold ${v.key === view ? "bg-navy text-white" : "text-muted"}`}>
              {v.label}
            </Link>
          ))}
        </nav>
        <DayNav base={base} prev={shift(-1)} next={shift(1)} today={today} label={label}
          isToday={view === "day" ? date === today : view === "month" ? date.slice(0, 7) === today.slice(0, 7) : monday(date) === monday(today)} />

        <GroomerFilter groomers={groomers} current={groomer} href={(g) => `/calendar?view=${view}&date=${date}${g ? `&groomer=${g}` : ""}`} />

        {(view === "day" || view === "agenda") && <WeekStrip date={date} today={today} view={view} q={q} />}

        {view === "day" && <DayTimeline date={date} appts={onDay(date)} blocks={blocksOn(date)} hours={hoursOf(date)} tz={tz} multi={multi} groomer={groomer} />}
        {view === "week" && <WeekGrid start={monday(date)} today={today} appts={appts} blocksOn={blocksOn} hoursOf={hoursOf} tz={tz} />}
        {view === "month" && (
          <MonthGrid start={gridStart} count={gridDays} month={date.slice(0, 7)} today={today} onDay={onDay} blocksOn={blocksOn} working={(d) => !!hoursOf(d)} />
        )}
        {view === "agenda" && <Agenda start={monday(date)} today={today} onDay={onDay} blocksOn={blocksOn} working={(d) => !!hoursOf(d)} tz={tz} />}
      </Page>
    </>
  );
}

function WeekStrip({ date, today, view, q }: { date: string; today: string; view: View; q: string }) {
  const start = monday(date);
  return (
    <div className="grid grid-cols-7 text-center">
      {Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i)).map((d) => (
        <Link key={d} href={`/calendar?view=${view}&date=${d}${q}`} aria-current={d === date ? "date" : undefined} className="flex flex-col items-center gap-1 py-1">
          <span className="text-xs font-semibold text-muted">{fmt(d, { weekday: "narrow" })}</span>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full font-semibold ${
            d === date ? "bg-brand text-white" : d === today ? "ring-2 ring-brand text-brand" : ""}`}>
            {Number(d.slice(8))}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Places overlapping visits side by side: each gets a lane and the lane count of its cluster. */
function lanes(list: { id: string; s: number; e: number }[]) {
  const out = new Map<string, { lane: number; of: number }>();
  const sorted = [...list].sort((a, b) => a.s - b.s);
  let cluster: typeof sorted = [];
  let clusterEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const a of cluster) {
      let lane = ends.findIndex((e) => e <= a.s);
      if (lane === -1) lane = ends.length;
      ends[lane] = a.e;
      out.set(a.id, { lane, of: 0 });
    }
    for (const a of cluster) out.get(a.id)!.of = ends.length;
    cluster = [];
  };
  for (const a of sorted) {
    if (a.s >= clusterEnd && cluster.length) flush();
    cluster.push(a);
    clusterEnd = Math.max(clusterEnd, a.e);
  }
  if (cluster.length) flush();
  return out;
}

function span(appts: AppointmentListItem[], tz: string, hours: { start: string; end: string } | null, extra: { s: number; e: number }[] = []) {
  const mins = appts.flatMap((a) => [toMin(hm(a.start_at, tz)), Math.min(toMin(hm(a.end_at, tz)) || 1440, 1440)])
    .concat(extra.filter((x) => x.e - x.s < 1440).flatMap((x) => [x.s, x.e]));
  const first = Math.min(hours ? toMin(hours.start) : 7 * 60, ...mins);
  const last = Math.max(hours ? toMin(hours.end) : 19 * 60, ...mins);
  return { first: Math.floor(first / 60) * 60, last: Math.ceil(last / 60) * 60 };
}

function DayTimeline({ date, appts, blocks, hours, tz, multi, groomer }: {
  date: string; appts: AppointmentListItem[]; blocks: TimeOff[]; hours: { start: string; end: string } | null; tz: string;
  multi: boolean; groomer: string | null;
}) {
  const visible = appts.filter((a) => !HIDDEN.includes(a.status));
  // All-day blocks sit above the hours, like all-day events on a phone calendar; the rest share the lanes.
  const clipped = blocks.map((t) => ({ t, ...clip(t, date, tz)! }));
  const allDay = clipped.filter((b) => b.s === 0 && b.e === 1440).map((b) => b.t);
  const cut = clipped.filter((b) => !(b.s === 0 && b.e === 1440));
  const { first, last } = span(visible, tz, hours, cut);
  const PX = 72; // pixels per hour
  const top = (min: number) => ((min - first) / 60) * PX;
  const placed = visible.map((a) => {
    const s = toMin(hm(a.start_at, tz));
    const e = ymd(a.end_at, tz) === date ? toMin(hm(a.end_at, tz)) : 1440;
    return { a, s, e: Math.max(e, s + 30) };
  });
  // Kept inside the hours shown.
  const shown = cut.map((b) => ({ ...b, s: Math.max(b.s, first), e: Math.max(Math.min(b.e, last), Math.max(b.s, first) + 30) }));
  const lane = lanes([...placed.map((p) => ({ id: p.a.id, s: p.s, e: p.e })), ...shown.map((b) => ({ id: b.t.id, s: b.s, e: b.e }))]);
  const total = visible.reduce((s, a) => s + a.total_cents, 0);
  const dogs = visible.reduce((s, a) => s + a.pets.length, 0);

  return (
    <section className="space-y-2" aria-label="Day schedule">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold">
          {hours ? `${visible.length} appts · ${dogs} dog${dogs === 1 ? "" : "s"} · ${money(total)}` : "Day off"}
          {appts.length > visible.length && <span className="font-normal text-muted"> · {appts.length - visible.length} cancelled</span>}
        </p>
        {visible.length > 0 && (
          <Link href={`/today?date=${date}${groomer ? `&groomer=${groomer}` : ""}`} className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-brand shadow-[var(--shadow-card)]">
            Map
          </Link>
        )}
      </div>
      {allDay.map((t) => (
        <Link key={t.id} href={`/calendar/block/${t.id}`}
          className={`flex justify-between gap-3 rounded-[var(--radius-card)] border border-line px-4 py-2.5 text-sm ${BLOCK_STYLE}`}>
          <span className="truncate font-semibold text-ink">{blockTitle(t)}</span>
          <span className="shrink-0">All day</span>
        </Link>
      ))}
      <div className="card relative overflow-hidden" style={{ height: ((last - first) / 60) * PX }}>
        {Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60).map((min) => {
          const off = !hours || min < toMin(hours.start) || min >= toMin(hours.end);
          const time = `${String(min / 60).padStart(2, "0")}:00`;
          const at = zonedToUtc(date, time, tz);
          return (
            <SlotButton key={min} date={date} time={time} groomer={groomer} label={`${dayLabel(at, tz)} · ${timeLabel(at, tz)}`}
              className={`absolute inset-x-0 flex border-t border-line text-left ${off ? "bg-bg/70" : "hover:bg-brand-soft/40"}`}
              style={{ top: top(min), height: PX }}>
              <span className="w-14 shrink-0 pl-2 pt-1 text-xs font-semibold text-muted">
                {timeLabel(at, tz).replace(":00", "")}
              </span>
            </SlotButton>
          );
        })}
        {shown.map(({ t, s, e }) => {
          const l = lane.get(t.id)!;
          return (
            <Link key={t.id} href={`/calendar/block/${t.id}`}
              className={`absolute overflow-hidden rounded-xl border border-line p-2 text-xs ${BLOCK_STYLE}`}
              style={{
                top: top(s) + 1, height: Math.max(top(e) - top(s) - 2, 28),
                left: `calc(3.5rem + (100% - 4rem) * ${l.lane / l.of})`, width: `calc((100% - 4rem) / ${l.of} - 4px)`,
              }}>
              <div className="truncate font-bold text-ink">{blockTitle(t)}</div>
              <div className="truncate">
                {timeLabel(t.start_at, tz)} – {timeLabel(t.end_at, tz)}
              </div>
            </Link>
          );
        })}
        {placed.map(({ a, s, e }) => {
          const l = lane.get(a.id)!;
          return (
            <Link key={a.id} href={`/appointments/${a.id}`}
              className={`absolute overflow-hidden rounded-xl border border-l-4 border-line bg-surface p-2 text-xs shadow-sm hover:shadow-md ${STATUS_BAR[a.status] ?? "border-l-muted"}`}
              style={{
                top: top(s) + 1, height: Math.max(top(e) - top(s) - 2, 28),
                left: `calc(3.5rem + (100% - 4rem) * ${l.lane / l.of})`, width: `calc((100% - 4rem) / ${l.of} - 4px)`,
              }}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-bold">{timeLabel(a.start_at, tz)} – {timeLabel(a.end_at, tz)}</span>
                {a.paid && <span className="shrink-0 font-bold text-success">Paid</span>}
              </div>
              <div className="truncate text-sm font-bold">
                {multi && <span aria-label={a.staff_name} title={a.staff_name} className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: a.staff_color }} />}
                {a.series_id && <span aria-label="Repeats" className="text-success">↻ </span>}{a.client_name}
              </div>
              <div className="truncate text-muted">{a.pets.map((p) => `${p.name} · ${p.services.join(", ")}`).join(" | ")}</div>
              <div className="truncate text-muted">{a.address_line}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WeekGrid({ start, today, appts, blocksOn, hoursOf, tz }: {
  start: string; today: string; appts: AppointmentListItem[]; blocksOn: (d: string) => TimeOff[];
  hoursOf: (d: string) => { start: string; end: string } | null; tz: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  const visible = appts.filter((a) => !HIDDEN.includes(a.status));
  const allHours = days.map(hoursOf).filter((h): h is { start: string; end: string } => !!h);
  const { first, last } = span(visible, tz, allHours.length
    ? { start: allHours.map((h) => h.start).sort()[0], end: allHours.map((h) => h.end).sort().at(-1)! } : null);
  const PX = 52;
  const top = (min: number) => ((min - first) / 60) * PX;
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[2.25rem_repeat(7,1fr)] border-b border-line text-center">
        <span />
        {days.map((d) => {
          const n = visible.filter((a) => ymd(a.start_at, tz) === d).reduce((s, a) => s + a.pets.length, 0);
          return (
            <Link key={d} href={`/calendar?view=day&date=${d}`} className="py-1.5">
              <span className="block text-[11px] font-semibold text-muted">{fmt(d, { weekday: "short" })}</span>
              <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${d === today ? "bg-brand text-white" : ""}`}>
                {Number(d.slice(8))}
              </span>
              <span className="block text-[11px] text-muted">🐶 {n}</span>
            </Link>
          );
        })}
      </div>
      <div className="relative grid grid-cols-[2.25rem_repeat(7,1fr)]" style={{ height: ((last - first) / 60) * PX }}>
        <div className="relative">
          {Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60).map((min) => (
            <span key={min} className="absolute left-1 text-[10px] font-semibold text-muted" style={{ top: top(min) + 2 }}>
              {((min / 60 + 11) % 12) + 1}{min < 720 ? "a" : "p"}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const h = hoursOf(d);
          const list = visible.filter((a) => ymd(a.start_at, tz) === d).map((a) => {
            const s = toMin(hm(a.start_at, tz));
            const e = ymd(a.end_at, tz) === d ? toMin(hm(a.end_at, tz)) : 1440;
            return { a, s, e: Math.max(e, s + 30) };
          });
          const lane = lanes(list.map((p) => ({ id: p.a.id, s: p.s, e: p.e })));
          return (
            <div key={d} className={`relative border-l border-line ${h ? "" : "bg-bg/80"}`}>
              {Array.from({ length: (last - first) / 60 }, (_, i) => (
                <span key={i} aria-hidden className="absolute inset-x-0 border-t border-line/70" style={{ top: i * PX }} />
              ))}
              {blocksOn(d).map((t) => {
                const c = clip(t, d, tz)!;
                const s = Math.max(c.s, first), e = Math.min(c.e, last);
                if (e <= s) return null;
                return (
                  <Link key={t.id} href={`/calendar/block/${t.id}`} title={blockTitle(t)}
                    className={`absolute inset-x-0 overflow-hidden px-0.5 text-[10px] leading-tight ${BLOCK_STYLE}`}
                    style={{ top: top(s), height: top(e) - top(s) }}>
                    {blockTitle(t)}
                  </Link>
                );
              })}
              {list.map(({ a, s, e }) => {
                const l = lane.get(a.id)!;
                return (
                  <Link key={a.id} href={`/appointments/${a.id}`} title={`${timeLabel(a.start_at, tz)} ${a.client_name}`}
                    className={`absolute overflow-hidden rounded-md border-l-[3px] bg-navy px-0.5 py-0.5 text-[10px] leading-tight text-white ${STATUS_BAR[a.status] ?? ""}`}
                    style={{ top: top(s) + 1, height: Math.max(top(e) - top(s) - 2, 18), left: `${(l.lane / l.of) * 100}%`, width: `calc(${100 / l.of}% - 2px)` }}>
                    <span className="block font-bold">{a.client_name.split(" ")[0]}</span>
                    <span className="block opacity-80">{a.pets.map((p) => p.name).join(", ")}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ start, count, month, today, onDay, blocksOn, working }: {
  start: string; count: number; month: string; today: string; onDay: (d: string) => AppointmentListItem[];
  blocksOn: (d: string) => TimeOff[]; working: (d: string) => boolean;
}) {
  const days = Array.from({ length: count }, (_, i) => addDaysYmd(start, i));
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold text-muted">
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <span key={i} className="py-1.5">{w}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = onDay(d).filter((a) => !HIDDEN.includes(a.status));
          const dogs = list.reduce((s, a) => s + a.pets.length, 0);
          const inMonth = d.startsWith(month);
          return (
            <Link key={d} href={`/calendar?view=day&date=${d}`}
              className={`min-h-24 border-b border-r border-line p-1 ${inMonth ? "" : "opacity-40"} ${working(d) ? "" : "bg-bg/80"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${d === today ? "bg-brand text-white" : ""}`}>
                {Number(d.slice(8))}
              </span>
              <span className="mt-0.5 block space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <span key={a.id} className="block truncate rounded bg-navy px-1 text-[10px] leading-4 text-white">{a.client_name}</span>
                ))}
                {list.length > 3 && <span className="block text-[10px] font-semibold text-muted">+{list.length - 3} more</span>}
                {blocksOn(d).length > 0 && (
                  <span className={`block truncate rounded px-1 text-[10px] leading-4 ${BLOCK_STYLE}`}>{blockTitle(blocksOn(d)[0])}</span>
                )}
              </span>
              {dogs > 0 && <span className="mt-0.5 block text-[10px] text-muted">🐶 {dogs}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ start, today, onDay, blocksOn, working, tz }: {
  start: string; today: string; onDay: (d: string) => AppointmentListItem[]; blocksOn: (d: string) => TimeOff[];
  working: (d: string) => boolean; tz: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  return (
    <>
      {days.map((d) => {
        const list = onDay(d);
        const active = list.filter((a) => !HIDDEN.includes(a.status));
        const off = !working(d);
        return (
          <section key={d} aria-labelledby={`day-${d}`} className="space-y-1">
            <div className="flex items-baseline justify-between px-1">
              <h2 id={`day-${d}`} className={`font-bold ${d === today ? "text-brand" : ""}`}>
                {fmt(d, { weekday: "short", month: "short", day: "numeric" })}
                {d === today && <span className="ml-2 text-xs font-semibold uppercase">Today</span>}
              </h2>
              <span className="text-sm text-muted">
                {off ? "Day off" : active.length
                  ? `${active.length} appts · ${active.reduce((s, a) => s + a.pets.length, 0)} dogs · ${money(active.reduce((s, a) => s + a.total_cents, 0))}`
                  : ""}
              </span>
            </div>
            {blocksOn(d).map((t) => {
              const c = clip(t, d, tz)!;
              return (
                <Link key={t.id} href={`/calendar/block/${t.id}`}
                  className={`flex justify-between gap-3 rounded-[var(--radius-card)] border border-line px-4 py-2.5 text-sm ${BLOCK_STYLE}`}>
                  <span className="truncate font-semibold text-ink">{blockTitle(t)}</span>
                  <span className="shrink-0">{c.s === 0 && c.e === 1440 ? "All day" : `${timeLabel(t.start_at, tz)} – ${timeLabel(t.end_at, tz)}`}</span>
                </Link>
              );
            })}
            {list.length === 0 ? (
              <Link href={`/appointments/new?date=${d}`}
                className="block rounded-[var(--radius-card)] border border-dashed border-line px-4 py-3 text-sm text-muted hover:bg-surface">
                {off ? "Day off · book anyway" : "Free · tap to book"}
              </Link>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link href={`/appointments/${a.id}`} className={`flex gap-3 border-l-4 px-4 py-3 hover:bg-bg ${STATUS_BAR[a.status] ?? "border-l-line"}`}>
                      <div className="w-20 shrink-0 text-sm">
                        <div className="font-semibold">{timeLabel(a.start_at, tz)}</div>
                        <div className="text-muted">{timeLabel(a.end_at, tz)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold">{a.client_name}</span>
                          <StatusBadge status={a.paid ? "paid" : a.status} />
                        </div>
                        <div className="truncate text-sm text-muted">
                          {a.pets.map((p) => `${p.name} · ${p.services.join(", ")}`).join(" | ")}
                        </div>
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="truncate text-muted">{a.address_line ?? a.city ?? ""}</span>
                          <span className="shrink-0 font-semibold">{money(a.total_cents)}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
