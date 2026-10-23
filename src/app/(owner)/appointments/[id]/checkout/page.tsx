import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { fullName } from "@/lib/data/clients";
import { getInvoiceForAppointment, methodLabel } from "@/lib/data/invoices";
import { formatInTimeZone } from "date-fns-tz";
import { dayLabel, money, timeLabel } from "@/lib/format";
import { Button, Input, Notice, Page, PageHeader } from "@/components/ui";
import {
  addInvoiceItemAction,
  recordPaymentAction,
  removeInvoiceItemAction,
  reopenInvoiceAction,
  saveVisitTimesAction,
  startCheckoutAction, deletePaymentAction } from "../../actions";
import { PaymentForm } from "../../payment-form";

export const metadata: Metadata = { title: "Invoice" };

// The bill of one visit: check-in and check-out times, services by pet, discounts, service
// charges or taxes, tips, what was paid and what is still due.

export default async function CheckoutPage({ params }: PageProps<"/appointments/[id]/checkout">) {
  const staff = await requireStaff();
  const { id } = await params;
  const appt = await getAppointment(staff, id);
  if (!appt) notFound();
  const data = await getInvoiceForAppointment(staff, id);
  const tz = staff.timezone;

  if (!data) {
    return (
      <>
        <PageHeader title="Checkout" back={`/appointments/${id}`} />
        <Page>
          <form action={startCheckoutAction.bind(null, id)}>
            <Button type="submit" className="w-full">Start checkout</Button>
          </form>
        </Page>
      </>
    );
  }

  const { invoice, items, payments } = data;
  const open = invoice.status === "open";
  const balance = Math.max(invoice.total_cents - invoice.paid_cents, 0);
  const services = items.filter((i) => !["discount", "tax", "fee"].includes(i.kind));
  const extras = items.filter((i) => ["discount", "tax", "fee"].includes(i.kind));
  // Services are saved as "Pet: service"; group them under each pet like on a receipt.
  const byPet = new Map<string, typeof services>();
  for (const s of services) {
    const [pet, ...rest] = s.description.split(": ");
    const key = rest.length ? pet : "";
    byPet.set(key, [...(byPet.get(key) ?? []), { ...s, description: rest.length ? rest.join(": ") : s.description }]);
  }
  const local = (d: Date | null) => (d ? formatInTimeZone(d, tz, "yyyy-MM-dd'T'HH:mm") : "");
  const stamp = (d: Date | null) => (d ? `${dayLabel(d, tz)} ${timeLabel(d, tz)}` : "—");
  const fees = invoice.tax_cents + extras.filter((e) => e.kind === "fee").reduce((s, e) => s + e.amount_cents, 0);
  const serviceAfterDiscount = Math.max(invoice.subtotal_cents - invoice.discount_cents, 0);

  return (
    <>
      <PageHeader title={`Invoice #${invoice.number}`} back={`/appointments/${id}`} />
      <Page>
        {!open && <Notice kind="success">Paid in full. Thank you!</Notice>}

        <details className="card px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
            <span className="space-y-1">
              <span className="flex gap-6"><span className="w-24 text-muted">Checked in</span>{stamp(appt.checked_in_at)}</span>
              <span className="flex gap-6"><span className="w-24 text-muted">Checked out</span>{stamp(appt.checked_out_at)}</span>
            </span>
            <span className="font-semibold text-brand">Edit</span>
          </summary>
          <form action={saveVisitTimesAction.bind(null, id)} className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-muted">Checked in
              <Input type="datetime-local" name="checked_in_at" defaultValue={local(appt.checked_in_at)} />
            </label>
            <label className="text-xs font-semibold text-muted">Checked out
              <Input type="datetime-local" name="checked_out_at" defaultValue={local(appt.checked_out_at)} />
            </label>
            <Button type="submit" kind="secondary" className="col-span-2">Save times</Button>
          </form>
        </details>

        <section className="card divide-y divide-line">
          {[...byPet.entries()].map(([pet, list]) => (
            <div key={pet || "visit"} className="px-4 py-3">
              {pet && <p className="mb-1 font-bold">{pet}</p>}
              <ul className="space-y-1 text-sm">
                {list.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="flex-1">{item.description}</span>
                    <span className="tabular-nums">{money(item.amount_cents)}</span>
                    {open && <RemoveButton appointmentId={id} itemId={item.id} label={item.description} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {extras.length > 0 && (
            <ul className="space-y-1 px-4 py-3 text-sm">
              {extras.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className={`flex-1 ${item.kind === "discount" ? "text-success" : ""}`}>{item.description}</span>
                  <span className={`tabular-nums ${item.kind === "discount" ? "text-success" : ""}`}>{money(item.amount_cents)}</span>
                  {open && <RemoveButton appointmentId={id} itemId={item.id} label={item.description} />}
                </li>
              ))}
            </ul>
          )}
          {open && (
            <div className="space-y-2 px-4 py-3">
              <AddItem appointmentId={id} kind="discount" title="+ Add a discount" placeholder="One-time discount" tone="text-brand" />
              <AddItem appointmentId={id} kind="fee" title="+ Add service charges" placeholder="Service charge" tone="text-success" />
              <AddItem appointmentId={id} kind="tax" title="+ Add tax" placeholder="Sales tax" tone="text-muted" />
            </div>
          )}
          <dl className="space-y-1.5 px-4 py-3 text-sm">
            <Row label="Sub total" value={money(invoice.subtotal_cents)} />
            {invoice.discount_cents > 0 && <Row label="Discount" value={`−${money(invoice.discount_cents)}`} />}
            <Row label="Tax and charges" value={money(fees)} />
            <Row label="Tips" value={money(invoice.tip_cents)} />
            <Row label="Total" value={money(invoice.total_cents)} strong />
            <Row label="Amount paid" value={money(invoice.paid_cents)} />
          </dl>
          <dl className="space-y-1.5 rounded-b-[var(--radius-card)] bg-bg px-4 py-3">
            <Row label="Total collected" value={money(invoice.paid_cents)} strong />
            <div className="flex justify-between font-bold">
              <dt>Balance outstanding</dt>
              <dd className={balance > 0 ? "text-danger" : "text-success"}>{money(balance)}</dd>
            </div>
          </dl>
        </section>

        {open && balance > 0 && (
          <section className="card px-4 py-5">
            <PaymentForm action={recordPaymentAction.bind(null, id)} balanceCents={balance}
              serviceCents={serviceAfterDiscount} clientName={fullName(appt.client)} />
          </section>
        )}

        {payments.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">Payments</h2>
            <ul className="card divide-y divide-line overflow-hidden text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{methodLabel(p.method)}{p.paid_by ? ` · ${p.paid_by}` : ""}</div>
                    <div className="text-muted">
                      {dayLabel(p.received_at, tz)} {timeLabel(p.received_at, tz)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </div>
                    {p.note && <div className="text-muted">{p.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{money(p.amount_cents + p.tip_cents)}</div>
                    {p.tip_cents > 0 && <div className="text-muted">incl. {money(p.tip_cents)} tip</div>}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-semibold text-danger">Remove</summary>
                      <form action={deletePaymentAction.bind(null, id, p.id)}>
                        <button type="submit" className="mt-1 rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white">Yes, remove it</button>
                      </form>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!open && (
          <form action={reopenInvoiceAction.bind(null, id)}>
            <Button type="submit" kind="ghost" className="w-full">Reopen to fix a mistake</Button>
          </form>
        )}
      </Page>
    </>
  );
}

function RemoveButton({ appointmentId, itemId, label }: { appointmentId: string; itemId: string; label: string }) {
  return (
    <form action={removeInvoiceItemAction.bind(null, appointmentId, itemId)}>
      <button type="submit" className="rounded-lg px-2 text-muted hover:text-danger" aria-label={`Remove ${label}`}>×</button>
    </form>
  );
}

function AddItem({ appointmentId, kind, title, placeholder, tone }: {
  appointmentId: string; kind: "discount" | "fee" | "tax"; title: string; placeholder: string; tone: string;
}) {
  return (
    <details>
      <summary className={`cursor-pointer list-none font-semibold ${tone}`}>{title}</summary>
      <form action={addInvoiceItemAction.bind(null, appointmentId)} className="mt-2 grid grid-cols-[1fr_5.5rem_4.5rem] gap-2">
        <input type="hidden" name="kind" value={kind} />
        <Input name="description" placeholder={placeholder} aria-label={`${title} description`} />
        <Input name="amount" inputMode="decimal" placeholder="$ or %" required aria-label={`${title} amount`} />
        <select name="unit" aria-label="Dollars or percent" className="rounded-xl border border-line bg-surface px-2">
          <option value="dollars">$</option>
          <option value="percent">%</option>
        </select>
        <Button type="submit" kind="secondary" className="col-span-3">Add</Button>
      </form>
    </details>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
