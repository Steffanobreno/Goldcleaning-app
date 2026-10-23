import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listDay } from "@/lib/data/appointments";
import { directionsUrl, routeUrl } from "@/lib/directions";
import { addDaysYmd, isYmd, longDayLabel, money, timeLabel, todayYmd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Empty, Page, PageHeader, StatusBadge } from "@/components/ui";
import { DayNav } from "@/components/day-nav";
import { Chat, Phone, Pin } from "@/components/icons";
import { RouteMap } from "@/components/route-map";
import { locateStops } from "@/lib/geocode";
import { GroomerFilter } from "@/components/groomer-filter";
import { listGroomers } from "@/lib/data/staff";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const today = todayYmd(tz);
  const date = isYmd(sp.date) ? sp.date : today;
  const [day, [{ requests }], groomers] = await Promise.all([
    listDay(staff, date),
    sql<{ requests: number }[]>`
      select count(*)::int as requests from appointments
      where business_id = ${staff.businessId} and status = 'requested' and start_at > now()`,
    listGroomers(staff, { activeOnly: true }),
  ]);
  // A route is one groomer's day: yours unless another one (or all) is picked.
  const groomer = sp.groomer === "all" ? null
    : groomers.some((g) => g.id === sp.groomer) ? (sp.groomer as string)
      : groomers.length > 1 ? staff.staffId : null;
  const all = groomer ? day.filter((a) => a.staff_id === groomer) : day;
  const stops = all.filter((a) => !["cancelled", "no_show"].includes(a.status));
  const [vaccines] = await Promise.all([
    vaccineAlerts(staff, stops.flatMap((s) => s.pets.map((p) => p.id)), date),
    locateStops(stops),
  ]);
  const pins = stops
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.lat != null && s.lng != null)
    .map(({ s, n }) => ({
      id: s.id, n, lat: s.lat!, lng: s.lng!, name: s.client_name,
      time: `${timeLabel(s.start_at, tz)} – ${timeLabel(s.end_at, tz)}`, done: s.status === "completed",
    }));
  const dropped = all.length - stops.length;
  const route = routeUrl(stops.map((s) => ({ address: s.address_line, lat: s.lat, lng: s.lng })));
  const expected = stops.reduce((sum, s) => sum + s.total_cents, 0);
  const done = stops.filter((s) => s.status === "completed").length;

  return (
    <>
      <PageHeader
        title={date === today ? "Today" : "Route"}
        action={<ButtonLink href={`/appointments/new?date=${date}`}>Book</ButtonLink>}
      />
      <Page>
        {requests > 0 && (
          <ButtonLink href="/requests" kind="secondary" className="w-full border-warn bg-warn-soft text-warn">
            {requests} booking request{requests > 1 ? "s" : ""} waiting
          </ButtonLink>
        )}
        <GroomerFilter groomers={groomers} current={groomer}
          href={(g) => `/today?date=${date}&groomer=${g ?? "all"}`} />
        <DayNav
          base={`/today?groomer=${groomer ?? "all"}&`}
          prev={addDaysYmd(date, -1)}
          next={addDaysYmd(date, 1)}
          today={today}
          label={longDayLabel(zonedToUtc(date, "12:00", tz), tz)}
          isToday={date === today}
        />

        {stops.length === 0 ? (
          <Empty title="No appointments this day">
            <Link href={`/appointments/new?date=${date}`} className="text-brand underline">Book one</Link>
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Stops" value={String(stops.length)} />
              <Stat label="Done" value={`${done}/${stops.length}`} />
              <Stat label="Expected" value={money(expected)} />
            </div>

            {pins.length > 0 && <RouteMap stops={pins} />}
            {pins.length < stops.length && (
              <p className="-mt-2 text-center text-xs text-muted">
                {stops.length - pins.length} stop{stops.length - pins.length > 1 ? "s" : ""} not on the map (address not found).
              </p>
            )}

            {route && (
              <ButtonLink href={route} target="_blank" className="w-full">
                Open the whole route in Google Maps
              </ButtonLink>
            )}

            <ol className="space-y-3">
              {stops.map((s, i) => (
                <li key={s.id} className="card overflow-hidden">
                  <Link href={`/appointments/${s.id}`} className="flex gap-3 p-4">
                    <div className="w-16 shrink-0">
                      <span aria-hidden className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="font-bold leading-tight">{timeLabel(s.start_at, tz)}</div>
                      <div className="text-xs text-muted">{timeLabel(s.end_at, tz)}</div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-lg font-bold leading-tight">{s.client_name}</span>
                        <StatusBadge status={s.paid ? "paid" : s.status} />
                      </div>
                      {s.pets.map((p) => (
                        <div key={p.name} className="truncate text-sm">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-muted"> · {p.services.join(", ")}</span>
                        </div>
                      ))}
                      <div className="truncate text-sm text-muted">{s.address_line ?? "No address"}</div>
                      {s.pets.flatMap((p) => vaccines.filter((v) => v.pet_id === p.id).map((v) => (
                        <div key={p.id + v.name} className={`text-xs font-semibold ${v.expired ? "text-danger" : "text-warn"}`}>
                          💉 {p.name}: {alertText(v)}
                        </div>
                      )))}
                    </div>
                  </Link>
                  <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-sm font-semibold text-brand">
                    {s.address_line ? (
                      <a href={directionsUrl({ address: s.address_line, lat: s.lat, lng: s.lng })} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-3 hover:bg-brand-soft">
                        <Pin size={16} /> Directions
                      </a>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5 py-3 text-muted">No address</span>
                    )}
                    <a href={`sms:${s.client_phone}`} className="flex items-center justify-center gap-1.5 py-3 hover:bg-brand-soft">
                      <Chat size={16} /> Text
                    </a>
                    <a href={`tel:${s.client_phone}`} className="flex items-center justify-center gap-1.5 py-3 hover:bg-brand-soft">
                      <Phone size={16} /> Call
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        {dropped > 0 && (
          <p className="text-center text-sm text-muted">
            {dropped} cancelled or no-show not shown. <Link href={`/calendar?date=${date}`} className="underline">See all</Link>
          </p>
        )}
      </Page>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
