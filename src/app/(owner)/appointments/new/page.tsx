import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { clientHistory, fullName, getClient, listClients, listPets } from "@/lib/data/clients";
import { listServices } from "@/lib/data/services";
import { dayLabel, isYmd, phoneLabel, timeLabel, todayYmd, zonedToUtc } from "@/lib/format";
import { ButtonLink, Empty, Input, Page, PageHeader } from "@/components/ui";
import { createAppointmentAction } from "../actions";
import { BookingForm } from "../booking-form";
import { listGroomers } from "@/lib/data/staff";
import { nearbyDays } from "@/lib/data/appointments";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";

export const metadata: Metadata = { title: "New appointment" };

const initials = (c: { first_name: string; last_name: string | null }) => (c.first_name[0] ?? "") + (c.last_name?.[0] ?? "");

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const clientId = typeof sp.client === "string" ? sp.client : null;
  const date = isYmd(sp.date) ? sp.date : todayYmd(staff.timezone);
  const time = typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : "09:00";
  const [client, groomers] = await Promise.all([
    clientId ? getClient(staff, clientId) : null,
    listGroomers(staff, { activeOnly: true }),
  ]);

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
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, phone or pet" autoFocus />
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
                        {[c.pet_names, phoneLabel(c.phone)].filter(Boolean).join(" · ")}
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

  // Step 2: pets, services and time.
  const [pets, services, history, nearby] = await Promise.all([
    listPets(staff, client.id),
    listServices(staff),
    clientHistory(staff, client.id),
    nearbyDays(staff, client.zip),
  ]);
  const count = (status: string) => history.filter((a) => a.status === status).length;
  const vaccines = await vaccineAlerts(staff, pets.map((p) => p.id), date);
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
        {nearby.length > 0 && pets.length > 0 && (
          <section className="card space-y-1 border-success bg-success-soft px-4 py-3">
            <h2 className="text-sm font-bold text-success">🚐 You&apos;re already near {client.first_name} on</h2>
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
        {pets.length === 0 ? (
          <Empty title="This client has no pets yet">
            <ButtonLink href={`/clients/${client.id}/pets/new`} className="mt-2">Add a pet</ButtonLink>
          </Empty>
        ) : (
          <BookingForm
            action={createAppointmentAction.bind(null, client.id)}
            pets={pets.map((p) => ({ ...p, vaccineAlert: vaccines.filter((v) => v.pet_id === p.id).map(alertText).join(" · ") || null }))}
            services={services}
            defaultDate={date}
            defaultTime={time}
            groomers={groomers}
            defaultGroomer={typeof sp.groomer === "string" ? sp.groomer : staff.staffId}
          />
        )}
      </Page>
    </>
  );
}
