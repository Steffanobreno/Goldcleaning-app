import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { clientHistory, clientSummary, fullAddress, fullName, getClient, listClientNotes } from "@/lib/data/clients";
import { accessLabel, homeSizeLabel, listHomes } from "@/lib/data/homes";
import { FREQUENCY_LABEL } from "@/lib/pricing";
import { AddressLink, PhoneLink } from "@/components/contact-sheet";
import { Chat, Mail, Phone } from "@/components/icons";
import { methodLabel } from "@/lib/payment-methods";
import { dayLabel, isUuid, money, phoneLabel, timeLabel } from "@/lib/format";
import { Button, ButtonLink, Card, Empty, Notice, Page, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { addNoteAction, deleteClientAction, deleteNoteAction, setClientControlAction } from "../actions";
import { activeAgreement, currentSignature } from "@/lib/agreement";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Everything at once: each round trip to the database adds a little wait.
  const [client, homes, notes, history, agreement, summary] = await Promise.all([
    getClient(staff, id),
    listHomes(staff, id),
    listClientNotes(staff, id),
    clientHistory(staff, id),
    activeAgreement(staff.businessId),
    clientSummary(staff, id),
  ]);
  if (!client) notFound();
  const signature = agreement ? await currentSignature(agreement, id) : null;
  const address = fullAddress(client);
  const tz = staff.timezone;
  // Soonest upcoming first, then the past, most recent first.
  const upcoming = history.filter((a) => a.upcoming).reverse();
  const past = history.filter((a) => !a.upcoming);
  const noShows = history.filter((a) => a.status === "no_show").length;
  // The frequency of their latest booking (upcoming first).
  const latest = upcoming[0] ?? past.find((a) => !["cancelled", "declined"].includes(a.status));

  return (
    <>
      <PageHeader
        title={fullName(client)}
        back="/clients"
        action={<ButtonLink kind="secondary" href={`/clients/${id}/edit`}>Edit</ButtonLink>}
      />
      <Page>
        <div className="card px-4 pb-4 pt-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy text-xl font-bold text-white">
              {(client.first_name[0] ?? "") + (client.last_name?.[0] ?? "")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold">{fullName(client)}</p>
              {client.archived_at && <span className="text-xs font-bold uppercase text-muted">Inactive</span>}
            </div>
            {client.email && <a href={`mailto:${client.email}`} aria-label="Email" className="rounded-full p-2 text-brand hover:bg-brand-soft"><Mail size={24} /></a>}
            <a href={`sms:${client.phone}`} aria-label="Text" className="rounded-full p-2 text-brand hover:bg-brand-soft"><Chat size={24} /></a>
            <a href={`tel:${client.phone}`} aria-label="Call" className="rounded-full p-2 text-brand hover:bg-brand-soft"><Phone size={24} /></a>
          </div>
          <dl className="mt-5 grid grid-cols-4 gap-y-4 text-center">
            {([
              ["Upcoming", String(upcoming.length), ""],
              ["Finished", String(history.filter((a) => a.status === "completed").length), ""],
              ["Cancelled", String(history.filter((a) => a.status === "cancelled").length), ""],
              ["No-show", String(noShows), noShows ? "text-danger" : ""],
              ["Total paid", money(summary.paid + summary.tips), ""],
              ["Unpaid", money(summary.unpaid), summary.unpaid ? "text-danger" : ""],
              ["Total appts", String(history.filter((a) => !["cancelled", "declined"].includes(a.status)).length), ""],
              ["Old app", client.imported_total_sales_cents ? money(client.imported_total_sales_cents) : "—", ""],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
                <dd className={`text-lg font-bold tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Appointments</h2>
            <ButtonLink kind="ghost" href={`/appointments/new?client=${id}`}>+ New appointment</ButtonLink>
          </div>
          {upcoming[0] && (
            <Link href={`/appointments/${upcoming[0].id}`} className="block rounded-2xl bg-success-soft px-4 py-3">
              <span className="block text-sm font-bold text-success">UPCOMING ({upcoming.length})</span>
              <span className="block font-semibold">{dayLabel(upcoming[0].start_at, tz)} · {timeLabel(upcoming[0].start_at, tz)}</span>
            </Link>
          )}
          {past[0] && (
            <Link href={`/appointments/${past[0].id}`} className="block rounded-2xl bg-bg px-4 py-3">
              <span className="block text-sm font-bold text-muted">HISTORY ({past.length})</span>
              <span className="block font-semibold">{dayLabel(past[0].start_at, tz)} · {timeLabel(past[0].start_at, tz)}</span>
            </Link>
          )}
        </section>

        <Card className="space-y-3">
          <h2 className="font-bold">Profile</h2>
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Phone</dt>
            <dd><PhoneLink phone={client.phone} label={phoneLabel(client.phone)} className="font-semibold text-brand" /></dd>
            {client.email && (
              <>
                <dt className="text-muted">Email</dt>
                <dd className="break-all"><a href={`mailto:${client.email}`} className="font-semibold text-brand">{client.email}</a></dd>
              </>
            )}
            <dt className="text-muted">Address</dt>
            <dd>
              {address ? (
                <AddressLink address={address} lat={client.lat} lng={client.lng} className="font-semibold text-brand" />
              ) : "Not set"}
            </dd>
            {client.access_notes && (
              <>
                <dt className="text-muted">Notes</dt>
                <dd className="whitespace-pre-line">{client.access_notes}</dd>
              </>
            )}
            <dt className="text-muted">Client since</dt>
            <dd>{dayLabel(client.imported_last_service_at && client.imported_last_service_at < client.created_at ? client.imported_last_service_at : client.created_at, tz)}</dd>
          </dl>
          {agreement &&
            (signature ? (
              <div className="space-y-1">
                <p className="text-sm text-success">
                  Agreement signed {dayLabel(signature.signed_at, tz)} by &quot;{signature.signed_name}&quot;
                </p>
                {signature.signature_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- the signature is a data URL
                  <img src={signature.signature_url} alt={`Signature of ${signature.signed_name}`} className="h-16 rounded-lg border border-line bg-white" />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Agreement not signed yet (they&apos;ll be asked on their confirm link).</p>
            ))}
          {client.imported_last_service_at && history.length === 0 && (
            <p className="text-sm text-muted">Last visit in the old app: {dayLabel(client.imported_last_service_at, tz)}</p>
          )}
          {!client.email && <Notice kind="warn">No email on file: this client gets no confirmations or reminders.</Notice>}
          {client.sms_opted_out_at && <Notice kind="warn">Messages are blocked: this client gets no automatic emails.</Notice>}
        </Card>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Homes</h2>
            <ButtonLink kind="ghost" href={`/clients/${id}/homes/new`}>Add home</ButtonLink>
          </div>
          {homes.length === 0 ? (
            <Empty title="No home yet">Add the home we clean before booking.</Empty>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {homes.map((h) => (
                <li key={h.id}>
                  <Link href={`/clients/${id}/homes/${h.id}`} className="card block p-3 hover:bg-bg">
                    <div className="font-semibold">{h.label} · {homeSizeLabel(h)}</div>
                    <div className="text-sm text-muted">{[h.address_line, h.city, h.zip].filter(Boolean).join(", ") || "No address"}</div>
                    {(h.access_method || h.access_code) && (
                      <div className="text-sm">🔑 {[accessLabel(h.access_method), h.access_code].filter(Boolean).join(" · ")}</div>
                    )}
                    {h.pets_in_home && <div className="text-sm text-warn">🐾 {h.pets_in_home}</div>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="section-label">All appointments</h2>
          {history.length === 0 ? (
            <Empty title="No appointments yet" />
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {[...upcoming, ...past].map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {dayLabel(a.start_at, tz)} · {timeLabel(a.start_at, tz)}
                      </div>
                      <div className="truncate text-sm text-muted">{[a.service_name, FREQUENCY_LABEL[a.frequency]].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div>{money(a.total_cents)}</div>
                      <StatusBadge status={a.paid ? "paid" : a.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Payment history</h2>
          <div className="card divide-y divide-line">
            <div className="grid grid-cols-2 px-4 py-3 text-sm">
              <span><span className="text-muted">Total paid </span><strong>{money(summary.paid + summary.tips)}</strong></span>
              <span><span className="text-muted">Unpaid </span><strong className={summary.unpaid ? "text-danger" : ""}>{money(summary.unpaid)}</strong></span>
            </div>
            {summary.payments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No payments recorded in this app yet.</p>
            ) : (
              summary.payments.map((p) => (
                <Link key={p.id} href={p.appointment_id ? `/appointments/${p.appointment_id}/checkout` : "#"} className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-bg">
                  <span>{dayLabel(p.received_at, tz)} · {methodLabel(p.method)}</span>
                  <span className="font-semibold tabular-nums">
                    {money(p.amount_cents + p.tip_cents)}
                    {p.tip_cents > 0 && <span className="font-normal text-muted"> (tip {money(p.tip_cents)})</span>}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Preference</h2>
          <dl className="card divide-y divide-line text-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">Booked frequency</dt>
              <dd className="font-semibold">{latest ? FREQUENCY_LABEL[latest.frequency] : "—"}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">Actual frequency</dt>
              <dd className="font-semibold">{summary.actualDays ? `${summary.actualDays} days` : "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Business control</h2>
          <div className="card divide-y divide-line">
            <Toggle clientId={id} control="inactive" on={!!client.archived_at} label="Inactive customer" hint="Hidden from the client list" />
            <Toggle clientId={id} control="block_messages" on={!!client.sms_opted_out_at} label="Block messages" hint="No automatic emails" />
            <Toggle clientId={id} control="block_online" on={client.online_booking_blocked} label="Block online booking" hint="They're asked to text you instead" />
            <Toggle clientId={id} control="no_marketing" on={!!client.email_unsubscribed_at} label="No marketing emails" hint="Left out of email campaigns (they can unsubscribe themselves too)" />
          </div>
        </section>

        <details className="card px-4 py-3">
          <summary className="cursor-pointer font-semibold text-danger">Remove client</summary>
          <div className="mt-3 space-y-3 text-sm">
            <p>
              This deletes {fullName(client)} for good, with {homes.length} home{homes.length === 1 ? "" : "s"},{" "}
              {history.length} visit{history.length === 1 ? "" : "s"}
              {summary.paid + summary.tips > 0 ? ` and ${money(summary.paid + summary.tips)} in payments (they leave your reports)` : ""}.
              It can&apos;t be undone. To just hide them, use <strong>Inactive customer</strong> above.
            </p>
            <form action={deleteClientAction.bind(null, id)}>
              <button type="submit" className="w-full rounded-xl bg-danger py-3 font-bold text-white">Yes, remove {client.first_name} forever</button>
            </form>
          </div>
        </details>

        <section className="space-y-2">
          <h2 className="section-label">Notes</h2>
          <form action={addNoteAction.bind(null, id)} className="space-y-2">
            <label className="sr-only" htmlFor="note">New note</label>
            <Textarea id="note" name="body" placeholder="Add a note about this client" required />
            <Button type="submit" kind="secondary">Add note</Button>
          </form>
          {notes.map((n) => (
            <Card key={n.id} className="text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>
                  {dayLabel(n.created_at, tz)} {timeLabel(n.created_at, tz)}
                  {n.staff_name ? ` · ${n.staff_name}` : ""}
                </span>
                <form action={deleteNoteAction.bind(null, id, n.id)}>
                  <button type="submit" className="font-semibold text-danger">Delete</button>
                </form>
              </div>
            </Card>
          ))}
        </section>
      </Page>
    </>
  );
}

function Toggle({ clientId, control, on, label, hint }: {
  clientId: string; control: "inactive" | "block_messages" | "block_online" | "no_marketing"; on: boolean; label: string; hint: string;
}) {
  return (
    <form action={setClientControlAction.bind(null, clientId, control, !on)}>
      <button type="submit" role="switch" aria-checked={on} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block font-medium">{label}</span>
          <span className="block text-xs text-muted">{hint}</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-line"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
        </span>
      </button>
    </form>
  );
}
