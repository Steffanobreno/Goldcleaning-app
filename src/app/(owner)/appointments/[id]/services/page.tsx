import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { loadCatalog } from "@/lib/data/catalog";
import { sql } from "@/lib/db";
import { durationMinutes } from "@/lib/pricing";
import { Notice, Page, PageHeader } from "@/components/ui";
import { saveLinesAction } from "../../actions";
import { BookingForm } from "../../booking-form";

export const metadata: Metadata = { title: "Edit price" };

export default async function EditPricePage({ params }: PageProps<"/appointments/[id]/services">) {
  const staff = await requireStaff();
  const { id } = await params;
  const [appt, catalog, [invoice]] = await Promise.all([
    getAppointment(staff, id),
    loadCatalog(staff.businessId),
    sql`select id from invoices where appointment_id = ${id} and business_id = ${staff.businessId}`,
  ]);
  if (!appt || !appt.home) notFound();
  const home = appt.home;
  const qty: Record<string, number> = {};
  for (const l of appt.lines) if (l.kind === "extra" && l.service_id) qty[l.service_id] = l.qty;
  const adjustCents = appt.lines.filter((l) => l.kind === "adjustment").reduce((sum, l) => sum + l.price_cents, 0);
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
              edit={{
                serviceId: appt.service_id ?? "",
                frequency: appt.frequency,
                qty,
                adjustCents,
                durationMin,
                baseMin: durationMinutes({ bedrooms: home.bedrooms, fullBaths: home.full_baths, halfBaths: home.half_baths }, catalog.rule),
              }}
            />
          </>
        )}
      </Page>
    </>
  );
}
