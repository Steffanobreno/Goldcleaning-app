import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { loadCatalog } from "@/lib/data/catalog";
import { activeDiscounts, homeStanding } from "@/lib/data/discounts";
import { sql } from "@/lib/db";
import { durationMinutes } from "@/lib/pricing";
import { Notice, Page, PageHeader } from "@/components/ui";
import { saveLinesAction } from "../../actions";
import { BookingForm } from "../../booking-form";

export const metadata: Metadata = { title: "Edit price" };

export default async function EditPricePage({ params }: PageProps<"/appointments/[id]/services">) {
  const staff = await requireStaff();
  const { id } = await params;
  const [appt, catalog, [invoice], discounts] = await Promise.all([
    getAppointment(staff, id),
    loadCatalog(staff.businessId),
    sql`select id from invoices where appointment_id = ${id} and business_id = ${staff.businessId}`,
    activeDiscounts(staff.businessId),
  ]);
  if (!appt || !appt.home) notFound();
  const home = appt.home;
  const qty: Record<string, number> = {};
  for (const l of appt.lines) if (l.kind === "extra" && l.service_id) qty[l.service_id] = l.qty;
  const adjustCents = appt.lines.filter((l) => l.kind === "adjustment").reduce((sum, l) => sum + l.price_cents, 0);
  const stand = await homeStanding(home.id);
  const couponId = appt.lines.find((l) => l.kind === "coupon")?.discount_id ?? null;
  // A discount that was switched off still shows on a visit that has it.
  const options = couponId && !discounts.some((d) => d.id === couponId)
    ? [...discounts, ...(await sql<{ id: string; name: string; kind: "percent" | "amount"; percent: string | null; amount_cents: number | null }[]>`select id, name, kind, percent, amount_cents from discounts where id = ${couponId}`).map((r) => ({ id: r.id, name: r.name, kind: r.kind, percent: r.percent == null ? null : Number(r.percent), amountCents: r.amount_cents }))]
    : discounts;
  const durationMin = Math.round((appt.end_at.getTime() - appt.start_at.getTime()) / 60_000);
  return (
    <>
      <PageHeader title="Edit price" back={`/appointments/${id}`} />
      <Page>
        {invoice ? (
          <Notice kind="info">Checkout already started for this visit. Change prices on the bill instead.</Notice>
        ) : (
          <>
            <Notice kind="info">Prices come from today&apos;s price list for this {home.label.toLowerCase()} ({home.bedrooms} bd / {home.full_baths} ba).</Notice>
            <BookingForm
              action={saveLinesAction.bind(null, id)}
              homes={[{ ...home, address: appt.address_line ?? "" }]}
              catalog={catalog}
              defaultHome={home.id}
              defaultDate=""
              defaultTime=""
              slotTimes={[]}
              standing={{ [home.id]: { adjustCents: stand.adjustCents, note: stand.adjustNote, discounts: stand.discounts } }}
              discounts={options}
              edit={{
                serviceId: appt.service_id ?? "",
                frequency: appt.frequency,
                qty,
                adjustCents,
                durationMin,
                agreedCents: catalog.services.find((s) => s.id === appt.service_id)?.pricing === "quote"
                  ? (appt.lines.find((l) => l.kind === "service")?.price_cents ?? null)
                  : null,
                couponId,
                baseMin: durationMinutes({ bedrooms: home.bedrooms, fullBaths: home.full_baths, halfBaths: home.half_baths }, catalog.rule),
              }}
            />
          </>
        )}
      </Page>
    </>
  );
}
