import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { clientHistory, fullName, getClient, listClients } from "@/lib/data/clients";
import { listHomes } from "@/lib/data/homes";
import { loadCatalog } from "@/lib/data/catalog";
import { sql } from "@/lib/db";
import { dayLabel, isYmd, phoneLabel, timeLabel, todayYmd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Empty, Input, Page, PageHeader } from "@/components/ui";
import { createAppointmentAction } from "../actions";
import { BookingForm } from "../booking-form";
import { nearbyDays } from "@/lib/data/appointments";

export const metadata: Metadata = { title: "New appointment" };

const initials = (c: { first_name: string; last_name: string | null }) => (c.first_name[0] ?? "") + (c.last_name?.[0] ?? "");

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const clientId = typeof sp.client === "string" ? sp.client : null;
  const date = isYmd(sp.date) ? sp.date : todayYmd(staff.timezone);
  const time = typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : "09:00";
  const client = clientId ? await getClient(staff, clientId) : null;

  // Step 1: pick the client.
  if (!client) {
    const q = String(sp.q ?? "");
    const clients = await listClients(staff, q);
    const keep = `&date=${date}&time=${time}${typeof sp.groomer === "string" ? `&groomer=${sp.groomer}` : ""}`;
    return (
      <>
        <PageHeader title="Who is it for?" back="/calendar" />
        <Page>
          <form role="search" className="flex gap-2">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
            {typeof sp.groomer === "string" && <input type="hidden" name="groomer" value={sp.groomer} />}
            <label className="sr-only" htmlFor="q">Search clients</label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, phone or address" autoFocus />
          </form>
          <ButtonLink kind="secondary" href="/clients/new" className="w-full">New client</ButtonLink>
          {clients.length === 0 ? (
            <Empty title="No client found" />
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/appointments/new?client=${c.id}${keep}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                      {initials(c)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{fullName(c)}</span>
                      <span className="block truncate text-sm text-muted">
                        {[c.home_summary, phoneLabel(c.phone)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Page>
      </>
    );
  }

  // Step 2: home, service, extras and time.
  const [homes, catalog, history, slots] = await Promise.all([
    listHomes(staff, client.id),
    loadCatalog(staff.businessId),
    clientHistory(staff, client.id),
    sql<{ time: string; label: string }[]>`
      select distinct to_char(start_time, 'HH24:MI') as time, label from booking_slots
      where business_id = ${staff.businessId} order by time`,
  ]);
  const homeParam = typeof sp.home === "string" ? sp.home : undefined;
  const nearby = await nearbyDays(staff, homes.find((h) => h.id === homeParam)?.zip ?? homes[0]?.zip ?? client.zip);
  const count = (status: string) => history.filter((a) => a.status === status).length;
  return (
    <>
      <PageHeader title={`Book ${fullName(client)}`} back={`/clients/${client.id}`} />
      <Page>
        <div className="card px-4 pb-4 pt-5 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy text-xl font-bold text-white">
            {initials(client)}
          </span>
          <p className="mt-2 text-lg font-bold">{fullName(client)}</p>
          <dl className="mt-3 grid grid-cols-4 gap-1">
            {([
              ["Upcoming", history.filter((a) => a.upcoming).length],
              ["Finished", count("completed")],
              ["Cancelled", count("cancelled")],
              ["No-show", count("no_show")],
            ] as const).map(([label, n]) => (
              <div key={label}>
                <dd className={`text-lg font-bold ${label === "No-show" && n > 0 ? "text-danger" : ""}`}>{n}</dd>
                <dt className="text-xs text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
        {nearby.length > 0 && homes.length > 0 && (
          <section className="card space-y-1 border-success bg-success-soft px-4 py-3">
            <h2 className="text-sm font-bold text-success">🧽 You&apos;re already near {client.first_name} on</h2>
            <ul className="divide-y divide-success/20 text-sm">
              {nearby.map((n) => (
                <li key={n.date}>
                  <Link href={`/appointments/new?client=${client.id}&date=${n.date}&time=${n.after}${typeof sp.groomer === "string" ? `&groomer=${sp.groomer}` : ""}`}
                    className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{dayLabel(zonedToUtc(n.date, "12:00", staff.timezone), staff.timezone)}</span>
                      <span className="text-muted"> · {n.miles < 1 ? "same area as" : `${Math.round(n.miles)} mi from`} {n.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-brand">{timeLabel(zonedToUtc(n.date, n.after, staff.timezone), staff.timezone)} →</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">Tap one to book right after that visit.</p>
          </section>
        )}
        {homes.length === 0 ? (
          <Empty title="This client has no home yet">
            <ButtonLink href={`/clients/${client.id}/homes/new`} className="mt-2">Add the home</ButtonLink>
          </Empty>
        ) : (
          <BookingForm
            action={createAppointmentAction.bind(null, client.id)}
            homes={homes.map((h) => ({ ...h, address: [h.address_line, h.city, h.zip].filter(Boolean).join(", ") }))}
            catalog={catalog}
            defaultHome={homeParam}
            defaultDate={date}
            defaultTime={time}
            slotTimes={slots}
          />
        )}
      </Page>
    </>
  );
}
