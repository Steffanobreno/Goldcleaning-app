import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getDraft, STEP_NAMES } from "@/lib/data/abandoned";
import { dayLabel, money, phoneLabel, sizeLabel, timeLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { addClientFromDraftAction, deleteDraftAction } from "../actions";
import { ContactButtons } from "../contact-buttons";

export const metadata: Metadata = { title: "Abandoned booking" };

export default async function AbandonedDraftPage({ params }: PageProps<"/abandoned/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const d = await getDraft(staff, id);
  if (!d) notFound();
  const tz = staff.timezone;
  const when = (x: Date) => `${dayLabel(x, tz)} ${timeLabel(x, tz)}`;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1 font-medium">{value || "—"}</span>
    </div>
  );
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || "Unknown name";
  const address = [d.address_line, d.city, d.zip].filter(Boolean).join(", ");
  return (
    <>
      <PageHeader title="Abandoned booking" back="/abandoned" />
      <Page>
        <section className="space-y-2">
          <h2 className="section-label">Booking</h2>
          <Card>
            {row("Abandoned", when(d.updated_at))}
            {row("Step", STEP_NAMES[d.step] ?? d.step)}
            {row("Time picked", d.chosen_start ? when(d.chosen_start) : null)}
            {row("Last contact", d.contacted_at ? `${when(d.contacted_at)} (you)` : d.reminded_at ? `${when(d.reminded_at)} (recovery message)` : null)}
            {d.status === "recovered" && row("Result", <span className="text-success">Booked{d.revenue_cents ? ` · ${money(d.revenue_cents)}` : ""}{d.booked_id && <> · <Link href={`/appointments/${d.booked_id}`} className="underline">see visit</Link></>}</span>)}
            {(d.pet_details ?? []).map((p, i) => (
              <div key={i} className="mt-2 border-t border-dashed border-line pt-2">
                {row("Pet", p.name)}
                {row("Breed", p.breed)}
                {row("Size", p.size ? sizeLabel(p.size) : null)}
                {row("Service", p.service)}
                {row("Add-ons", p.addons.join(", "))}
              </div>
            ))}
            {!d.pet_details?.length && d.pets && row("Pets", d.pets)}
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Client</h2>
          <Card className="space-y-1">
            <p className="flex items-center gap-2 text-lg font-bold">
              {d.client_id ? <Link href={`/clients/${d.client_id}`} className="underline-offset-2 hover:underline">{name}</Link> : name}
              {!d.client_id && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">New</span>}
            </p>
            <p className="text-sm">📞 {phoneLabel(d.phone)}</p>
            {d.email && <p className="text-sm">✉️ <a href={`mailto:${d.email}`} className="text-brand underline">{d.email}</a></p>}
            {address && <p className="text-sm">📍 {address}</p>}
            <ContactButtons id={d.id} phone={d.phone} className="pt-2" />
          </Card>
        </section>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <form action={deleteDraftAction.bind(null, d.id)}>
            <button type="submit" className="w-full rounded-full border-2 border-danger py-3 font-bold text-danger">Delete</button>
          </form>
          <form action={addClientFromDraftAction.bind(null, d.id)}>
            <button type="submit" className="w-full rounded-full bg-brand py-3 font-bold text-on-brand">
              {d.client_id ? "Book them" : "Add client"}
            </button>
          </form>
        </div>
      </Page>
    </>
  );
}
