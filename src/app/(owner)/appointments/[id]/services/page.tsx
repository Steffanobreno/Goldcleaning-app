import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getAppointment } from "@/lib/data/appointments";
import { listServices } from "@/lib/data/services";
import { sql } from "@/lib/db";
import { Notice, Page, PageHeader } from "@/components/ui";
import { ServicesEditor } from "./services-editor";

export const metadata: Metadata = { title: "Edit services" };

export default async function EditServicesPage({ params }: PageProps<"/appointments/[id]/services">) {
  const staff = await requireStaff();
  const { id } = await params;
  const [appt, services, [invoice]] = await Promise.all([
    getAppointment(staff, id),
    listServices(staff),
    sql`select id from invoices where appointment_id = ${id} and business_id = ${staff.businessId}`,
  ]);
  if (!appt) notFound();
  return (
    <>
      <PageHeader title="Edit services" back={`/appointments/${id}`} />
      <Page>
        {invoice ? (
          <Notice kind="info">Checkout already started for this visit. Change prices on the bill instead.</Notice>
        ) : (
          <ServicesEditor
            appointmentId={id}
            startIso={appt.start_at.toISOString()}
            timezone={staff.timezone}
            pets={appt.pets.map((p) => ({
              appointmentPetId: p.appointment_pet_id,
              name: p.name,
              size: p.size_class,
              lines: p.services.map((s) => ({ id: s.id, serviceId: s.service_id, name: s.name, priceCents: s.price_cents, minutes: s.duration_min })),
            }))}
            catalog={services.map((s) => ({
              id: s.id, name: s.name, kind: s.kind, size: s.size_class, priceCents: s.price_cents, minutes: s.duration_min,
            }))}
          />
        )}
      </Page>
    </>
  );
}
