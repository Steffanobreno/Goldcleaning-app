import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listServices } from "@/lib/data/services";
import { sql } from "@/lib/db";
import { money } from "@/lib/format";
import { FREQUENCIES, FREQUENCY_LABEL, type Frequency } from "@/lib/pricing";
import { ButtonLink, Card, Input, Page, PageHeader } from "@/components/ui";
import { moveServiceAction, saveRatesAction } from "../actions";
import { SimpleForm } from "../forms";

export const metadata: Metadata = { title: "Price list" };

// The price list: for each cleaning, a row of prices per frequency (start for 1 bedroom /
// 1 bath, then each extra bedroom, full bath and half bath); then the extras. New prices apply
// to new bookings; booked cleanings keep theirs.

const COLUMNS = [
  { key: "start", label: "Start", field: "start_cents" },
  { key: "bedroom", label: "+ Bedroom", field: "bedroom_cents" },
  { key: "full_bath", label: "+ Full bath", field: "full_bath_cents" },
  { key: "half_bath", label: "+ Half bath", field: "half_bath_cents" },
] as const;
type RateRow = { service_id: string; frequency: Frequency; start_cents: number; bedroom_cents: number; full_bath_cents: number; half_bath_cents: number };

export default async function PriceListPage() {
  const staff = await requireStaff();
  const [services, rates] = await Promise.all([
    listServices(staff, { includeInactive: true }),
    sql<RateRow[]>`
      select r.service_id, r.frequency, r.start_cents, r.bedroom_cents, r.full_bath_cents, r.half_bath_cents
      from service_rates r join services s on s.id = r.service_id where s.business_id = ${staff.businessId}`,
  ]);
  const cleanings = services.filter((s) => s.kind === "service");
  const extras = services.filter((s) => s.kind === "extra");
  const dollars = (c: number | undefined) => (c == null ? "" : (c / 100).toFixed(2));
  return (
    <>
      <PageHeader title="Price list" back="/settings" action={<ButtonLink href="/settings/services/new">Add</ButtonLink>} />
      <Page>
        <p className="px-1 text-sm text-muted">
          Price = start (1 bedroom, 1 bath) + each extra bedroom + each extra full bath + each half bath + extras. A studio is
          priced as 1 bedroom. New prices apply to new bookings; booked cleanings keep theirs.
        </p>
        {cleanings.map((s) => (
          <Card key={s.id} className="space-y-3" aria-label={s.name}>
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/settings/services/${s.id}`} className={`font-bold underline-offset-2 hover:underline ${s.active ? "" : "text-muted line-through"}`}>
                {s.name}
              </Link>
              <span className="text-xs text-muted">{s.pricing === "quote" ? "By quote" : s.recurring ? "Can repeat" : "One-time"}</span>
            </div>
            {s.pricing === "quote" ? (
              <p className="text-sm text-muted">No price online: clients send a quote request, and you book them at the price you agree.</p>
            ) : (
              <SimpleForm action={saveRatesAction.bind(null, s.id)} submitLabel={`Save ${s.name} prices`} savedLabel="Prices saved.">
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="px-1 pb-1 font-semibold">How often</th>
                        {COLUMNS.map((c) => <th key={c.key} className="px-1 pb-1 font-semibold">{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(s.recurring ? FREQUENCIES : (["one_time"] as Frequency[])).map((f) => {
                        const r = rates.find((x) => x.service_id === s.id && x.frequency === f);
                        return (
                          <tr key={f}>
                            <th scope="row" className="whitespace-nowrap px-1 py-1 text-left font-medium">{FREQUENCY_LABEL[f]}</th>
                            {COLUMNS.map((c) => (
                              <td key={c.key} className="px-1 py-1">
                                <Input name={`${f}:${c.key}`} inputMode="decimal" defaultValue={dollars(r?.[c.field])}
                                  aria-label={`${s.name} ${FREQUENCY_LABEL[f]} ${c.label}`} className="px-2" />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted">Leave a whole row empty to stop offering that frequency.</p>
              </SimpleForm>
            )}
          </Card>
        ))}

        <section className="space-y-1">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Extras</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {extras.map((s, i) => (
              <li key={s.id} className="flex items-center">
                <Link href={`/settings/services/${s.id}`} className="min-w-0 flex-1 px-4 py-3 hover:bg-bg">
                  <div className={`truncate font-medium ${s.active ? "" : "text-muted line-through"}`}>{s.name}</div>
                  <div className="text-sm text-muted">{s.per_unit ? "Per unit" : "On/off"}{!s.active && " · inactive"}</div>
                </Link>
                <span className="px-2 font-semibold text-brand">{money(s.price_cents)}</span>
                <div className="flex flex-col pr-2">
                  <form action={moveServiceAction.bind(null, s.id, "up")}>
                    <button type="submit" disabled={i === 0} className="px-2 text-muted disabled:opacity-30" aria-label={`Move ${s.name} up`}>▲</button>
                  </form>
                  <form action={moveServiceAction.bind(null, s.id, "down")}>
                    <button type="submit" disabled={i === extras.length - 1} className="px-2 text-muted disabled:opacity-30" aria-label={`Move ${s.name} down`}>▼</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Page>
    </>
  );
}
