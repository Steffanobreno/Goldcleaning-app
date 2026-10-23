import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { getInvoiceForAppointment } from "@/lib/data/invoices";
import { smsTextFor } from "@/lib/messaging";
import { sql } from "@/lib/db";
import { fullName } from "@/lib/data/clients";
import { addDaysYmd, hm, longDayLabel, minutesLabel, money, phoneLabel, sizeLabel, timeLabel, ymd } from "@/lib/format";
import { Button, Card, Notice, Page, PageHeader, statusLabel, Textarea } from "@/components/ui";
import { Calendar, Card as Card2, Chat, Check, ChevronDown, ChevronRight, Clock, Close, Hourglass, Pencil, Phone, Pin, Plus, Van } from "@/components/icons";
import { NEXT_STATUS } from "@/lib/appointment-status";
import { ruleLabel, type RepeatRule } from "@/lib/repeat";
import { assignGroomerAction, setStatusAction, rescheduleAction, startCheckoutAction, updateNotesAction } from "../actions";
import { listGroomers } from "@/lib/data/staff";
import { alertText, vaccineAlerts } from "@/lib/data/vaccines";
import { RescheduleForm } from "../reschedule-form";
import { PetPhoto } from "@/components/pet-photo";
import { AddressLink, PhoneLink } from "@/components/contact-sheet";

export const metadata: Metadata = { title: "Appointment" };

// The main next step for each status, shown as the big button.
const PRIMARY: Record<string, { to: string; label: string } | undefined> = {
  requested: { to: "unconfirmed", label: "Accept request" },
  unconfirmed: { to: "confirmed", label: "Mark as confirmed" },
  confirmed: { to: "en_route", label: "I'm on the way" },
  en_route: { to: "in_progress", label: "Check in" },
  in_progress: { to: "completed", label: "Finish and check out" },
};

const TRIGGER_LABEL: Record<string, string> = {
  booked: "Booking confirmation",
  request_received: "Request received",
  request_declined: "Request declined",
  reminder: "Reminder",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  rebook: "Time to rebook",
  review_request: "Review request",
};
const MESSAGE_STATUS: Record<string, string> = {
  queued: "Waiting for your iPhone",
  handed_off: "Sent from iPhone",
  sent: "Sent",
  failed: "Failed",
  skipped: "Not sent (too late)",
};

export default async function AppointmentPage({ params, searchParams }: PageProps<"/appointments/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const appt = await getAppointment(staff, id);
  if (!appt) notFound();
  const [checkout, onMyWay, messages, [series], groomers, vaccines] = await Promise.all([
    getInvoiceForAppointment(staff, id),
    smsTextFor(id, "on_my_way"),
    sql<{ id: string; channel: string; status: string; template_trigger: string | null; created_at: Date }[]>`
      select id, channel, status, template_trigger, created_at from messages
      where appointment_id = ${id} and business_id = ${staff.businessId} order by created_at desc limit 20`,
    sql<{ freq: RepeatRule["freq"]; interval_n: number; occurrences: number | null; ends_on: string | null; first: Date; upcoming: number }[]>`
      select s.freq, s.interval_n, s.occurrences, to_char(s.ends_on, 'YYYY-MM-DD') as ends_on,
        (select min(x.start_at) from appointments x where x.series_id = s.id) as first,
        (select count(*)::int from appointments x where x.series_id = s.id and x.start_at > ${appt.start_at}
           and x.status in ('unconfirmed', 'confirmed')) as upcoming
      from appointment_series s where s.id = ${appt.series_id ?? null}::uuid`,
    listGroomers(staff),
    vaccineAlerts(staff, appt.pets.map((p) => p.pet_id), ymd(appt.start_at, staff.timezone)),
  ]);
  const groomer = groomers.find((g) => g.id === appt.staff_id);
  const otherGroomers = groomers.filter((g) => g.active && g.id !== appt.staff_id);
  const tz = staff.timezone;
  const c = appt.client;
  const minutes = Math.round((appt.end_at.getTime() - appt.start_at.getTime()) / 60000);
  const total = appt.pets.flatMap((p) => p.services).reduce((s, x) => s + x.price_cents, 0);
  const primary = PRIMARY[appt.status];
  const paid = checkout?.invoice.status === "closed";
  const closed = ["cancelled", "no_show", "declined"].includes(appt.status);
  // Next visit: the shortest grooming frequency among the pets, or 6 weeks.
  const frequencies = appt.pets.map((p) => p.rebook_every_days).filter((d): d is number => d != null);
  const rebookDays = frequencies.length ? Math.min(...frequencies) : 42;
  const nextDate = addDaysYmd(ymd(appt.start_at, tz), rebookDays);

  const rebookWeeks = Math.round(rebookDays / 7);
  const canChange = !closed && appt.status !== "completed";
  const canMove = ["requested", "unconfirmed", "confirmed"].includes(appt.status); // not once on the way
  const pillar = "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-xs font-semibold text-brand hover:bg-brand-soft";

  return (
    <>
      <PageHeader title="Appointment" back={`/today?date=${ymd(appt.start_at, tz)}`} />
      <Page>
        {sp.booked === "1" && <Notice kind="success">Appointment booked.</Notice>}
        {sp.conflict === "1" && <Notice kind="error">Another appointment already uses that time.</Notice>}
        {appt.reschedule_requested_at && (
          <div className="rounded-2xl border border-warn bg-warn-soft px-4 py-3 text-warn">
            <p className="font-bold">The client asked for a different time</p>
            {appt.reschedule_note && <p className="mt-1 text-ink">&quot;{appt.reschedule_note}&quot;</p>}
            <p className="mt-1 text-sm">Move it below in Reschedule (this note clears when you do), or text them.</p>
          </div>
        )}

        <details className="card group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span aria-hidden className={`h-3 w-3 rounded-full ${STATUS_DOT[appt.status] ?? "bg-muted"}`} />
            <span className="flex-1 font-bold uppercase tracking-wide">{STATUS_NAME[appt.status] ?? statusLabel(appt.status)}</span>
            {paid ? <span className="text-sm font-bold text-success">PAID</span>
              : appt.status === "completed" ? <span className="text-sm font-bold text-danger">UNPAID</span> : null}
            {(NEXT_STATUS[appt.status]?.length ?? 0) > 0 && <ChevronDown size={18} className="text-muted transition group-open:rotate-180" />}
          </summary>
          <div className="grid gap-2 border-t border-line p-3">
            {(NEXT_STATUS[appt.status] ?? []).map((to) => (
              <form key={to} action={setStatusAction.bind(null, id, to)}>
                <button type="submit" className={`w-full rounded-full py-3 font-semibold ${["cancelled", "no_show", "declined"].includes(to) ? "bg-danger-soft text-danger" : "bg-bg"}`}>
                  {STATUS_NAME[to] ?? statusLabel(to)}
                </button>
              </form>
            ))}
          </div>
        </details>

        <nav aria-label="Actions" className="card grid grid-cols-3 gap-1 p-2">
          <a href={`sms:${c.phone}`} className={pillar}><Chat size={22} />Message</a>
          <a href={`tel:${c.phone}`} className={pillar}><Phone size={22} />Call</a>
          {!paid && ["in_progress", "completed", "en_route", "confirmed", "unconfirmed"].includes(appt.status) && (
            <Link href={`/appointments/${id}/checkout`} className={pillar}><Card2 size={22} />Take payment</Link>
          )}
          {appt.address_line ? (
            <AddressLink address={[appt.address_line, appt.zip].filter(Boolean).join(" ")} lat={appt.lat} lng={appt.lng} className={`${pillar} !text-center`}>
              <Pin size={22} />Directions
            </AddressLink>
          ) : (
            <span className={`${pillar} opacity-40`}><Pin size={22} />No address</span>
          )}
          {["confirmed", "unconfirmed", "en_route"].includes(appt.status) && onMyWay && (
            <a href={`sms:${c.phone}&body=${encodeURIComponent(onMyWay)}`} className={pillar}><Van size={22} />On my way</a>
          )}
          {canMove && <a href="#reschedule" className={pillar}><Calendar size={22} />Reschedule</a>}
          {canChange && <Link href={`/appointments/${id}/services`} className={pillar}><Pencil size={22} />Edit services</Link>}
          <Link href={`/appointments/new?client=${c.id}&date=${nextDate}&time=${hm(appt.start_at, tz)}`} className={pillar}>
            <Plus size={22} />Book again
          </Link>
          {canChange && (
            <form action={setStatusAction.bind(null, id, "cancelled")} className="contents">
              <button type="submit" className={`${pillar} text-danger hover:bg-danger-soft`}><Close size={22} />Cancel</button>
            </form>
          )}
          {canChange && appt.status !== "requested" && (
            <form action={setStatusAction.bind(null, id, "no_show")} className="contents">
              <button type="submit" className={`${pillar} text-danger hover:bg-danger-soft`}><Hourglass size={22} />No-show</button>
            </form>
          )}
          {closed && (
            <form action={setStatusAction.bind(null, id, "unconfirmed")} className="contents">
              <button type="submit" className={pillar}><Check size={22} />Restore</button>
            </form>
          )}
        </nav>

        <section className="space-y-2">
          <h2 className="section-label">When</h2>
          <div className="card flex items-center gap-3 px-4 py-4">
            <div className="flex-1">
              <p className="text-lg font-bold">{longDayLabel(appt.start_at, tz)}</p>
              <p className="text-muted">{timeLabel(appt.start_at, tz)} – {timeLabel(appt.end_at, tz)} · {minutesLabel(minutes)}</p>
            </div>
            {canMove && <a href="#reschedule" aria-label="Change the time" className="rounded-full p-2 text-muted hover:bg-bg"><Pencil size={20} /></a>}
          </div>
          {(groomers.length > 1 || appt.staff_id !== staff.staffId) && groomer && (
            <div className="card space-y-2 px-4 py-3">
              {sp.groomerBusy && <Notice kind="error">That groomer already has a visit at this time.</Notice>}
              <div className="flex items-center gap-3">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: groomer.color }} />
                <span className="flex-1"><span className="text-sm text-muted">Groomer</span> <span className="font-semibold">{groomer.name}</span></span>
              </div>
              {otherGroomers.length > 0 && !["completed", "cancelled", "no_show", "declined"].includes(appt.status) && (
                <form action={assignGroomerAction.bind(null, id)} className="flex gap-2">
                  <select name="staff_id" aria-label="Give to" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                    {otherGroomers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <Button type="submit" kind="secondary">Give to</Button>
                </form>
              )}
            </div>
          )}
          {appt.status !== "requested" && !["cancelled", "no_show", "declined"].includes(appt.status) && (
            <Link href={`/appointments/${id}/repeat`} className="card flex items-center gap-3 px-4 py-3.5">
              <span aria-hidden className="text-xl text-success">↻</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{series ? "Repeat appointment" : "Repeat this appointment"}</span>
                <span className="block truncate text-sm text-muted">
                  {series
                    ? `${ruleLabel(ymd(series.first, tz), { freq: series.freq, every: series.interval_n, count: series.occurrences, until: series.ends_on })} · ${series.upcoming} more after this one`
                    : "Every week, every 2 weeks, every month…"}
                </span>
              </span>
              <ChevronRight size={20} className="text-muted" />
            </Link>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Pets and services</h2>
            {canChange && <Link href={`/appointments/${id}/services`} className="text-sm font-semibold text-brand">Edit</Link>}
          </div>
          {appt.pets.map((p) => (
            <div key={p.appointment_pet_id} className="card divide-y divide-line">
              <div className="flex items-center gap-3 px-4 py-3">
                <PetPhoto petId={p.pet_id} version={p.photo_version} name={p.name} />
                <div className="min-w-0">
                  <div className="text-lg font-bold">{p.name}</div>
                  <div className="text-sm text-muted">{[p.breed, sizeLabel(p.size_class)].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              {vaccines.some((v) => v.pet_id === p.pet_id) && (
                <div className="space-y-1 px-4 py-3">
                  {vaccines.filter((v) => v.pet_id === p.pet_id).map((v) => (
                    <Notice key={v.name} kind={v.expired ? "error" : "warn"}>
                      💉 {alertText(v)}{v.expired ? " — ask for the new certificate" : ""}
                    </Notice>
                  ))}
                  <Link href={`/clients/${c.id}/pets/${p.pet_id}`} className="block text-xs font-semibold text-brand">Update vaccines</Link>
                </div>
              )}
              {(p.behavior || p.notes) && (
                <div className="space-y-2 px-4 py-3">
                  {p.behavior && <Notice kind="warn">{p.behavior}</Notice>}
                  {p.notes && <p className="whitespace-pre-line text-sm text-muted">{p.notes}</p>}
                </div>
              )}
              {p.services.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted"><Clock size={14} />{minutesLabel(s.duration_min)}</span>
                  </span>
                  <span className="font-semibold">{money(s.price_cents)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between px-1 text-lg font-bold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Customer</h2>
          <div className="card divide-y divide-line">
            <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3" aria-label="Client profile">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
              </span>
              <span className="flex-1 font-semibold">{fullName(c)}</span>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">every {rebookWeeks} weeks</span>
            </Link>
            <PhoneLink phone={c.phone} label={phoneLabel(c.phone)} className="flex w-full items-center gap-3 px-4 py-3 text-brand">
              <Phone size={18} /> {phoneLabel(c.phone)}
            </PhoneLink>
            {appt.address_line ? (
              <AddressLink address={[appt.address_line, appt.zip].filter(Boolean).join(" ")} lat={appt.lat} lng={appt.lng}
                className="flex w-full items-center gap-3 px-4 py-3 text-brand">
                <Pin size={18} className="shrink-0" /> {appt.address_line}{appt.zip ? ` ${appt.zip}` : ""}
              </AddressLink>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 text-muted"><Pin size={18} /> No address on file</div>
            )}
            {c.access_notes && <div className="px-4 py-3"><Notice kind="info">{c.access_notes}</Notice></div>}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Visit notes</h2>
          <form action={updateNotesAction.bind(null, id)} className="space-y-2">
            <label className="sr-only" htmlFor="notes">Visit notes</label>
            <Textarea id="notes" name="notes" defaultValue={appt.notes ?? ""} placeholder="Private notes for this visit" />
            <Button type="submit" kind="secondary">Save notes</Button>
          </form>
        </section>

        {canMove && (
          <section className="scroll-mt-20 space-y-2" id="reschedule">
            <h2 className="section-label">Reschedule</h2>
            <Card>
              <RescheduleForm
                action={rescheduleAction.bind(null, id)}
                date={ymd(appt.start_at, tz)}
                time={hm(appt.start_at, tz)}
              />
            </Card>
          </section>
        )}

        {messages.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">Messages to the client</h2>
            <ul className="card divide-y divide-line overflow-hidden text-sm">
              {messages.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 px-4 py-2.5">
                  <span>
                    {TRIGGER_LABEL[m.template_trigger ?? ""] ?? m.template_trigger} · {m.channel === "sms" ? "Text" : "Email"}
                  </span>
                  <span className="text-muted">{MESSAGE_STATUS[m.status] ?? m.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-center text-xs text-muted">
          <Link href={`/calendar?date=${ymd(appt.start_at, tz)}`} className="underline">See this day in the calendar</Link>
        </p>
        {/* Room for the button fixed at the bottom. */}
        {(primary || appt.status === "completed") && <div aria-hidden className="h-16" />}
      </Page>

      {(primary || appt.status === "completed") && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            {primary ? (
              <form action={setStatusAction.bind(null, id, primary.to)}>
                <button type="submit" className={`w-full rounded-2xl py-3.5 text-base font-bold text-white ${primary.to === "in_progress" ? "bg-success" : "bg-brand"}`}>
                  {primary.label}
                </button>
              </form>
            ) : paid ? (
              <Link href={`/appointments/${id}/checkout`} className="block w-full rounded-2xl bg-success py-3.5 text-center text-base font-bold text-white">
                See receipt
              </Link>
            ) : checkout ? (
              <Link href={`/appointments/${id}/checkout`} className="block w-full rounded-2xl bg-danger py-3.5 text-center text-base font-bold text-white">
                Charge now {money(Math.max(checkout.invoice.total_cents - checkout.invoice.paid_cents, 0))}
              </Link>
            ) : (
              <form action={startCheckoutAction.bind(null, id)}>
                <button type="submit" className="w-full rounded-2xl bg-danger py-3.5 text-base font-bold text-white">Charge now {money(total)}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Names in the status menu, as the groomer says them.
const STATUS_NAME: Record<string, string> = {
  requested: "Requested",
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  en_route: "On the way",
  in_progress: "Checked in",
  completed: "Finished",
  cancelled: "Cancelled",
  no_show: "No-show",
  declined: "Declined",
};

const STATUS_DOT: Record<string, string> = {
  requested: "bg-warn",
  unconfirmed: "bg-danger",
  confirmed: "bg-brand",
  en_route: "bg-sky",
  in_progress: "bg-success",
  completed: "bg-navy",
  paid: "bg-success",
};
