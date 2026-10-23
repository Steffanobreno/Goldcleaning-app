import "server-only";
import type { TransactionSql } from "postgres";
import type { Frequency, PriceLine } from "../pricing";

export type NewAppointment = {
  businessId: string;
  clientId: string;
  staffId: string;
  homeId: string;
  serviceId: string;
  frequency: Frequency;
  startAt: Date;
  durationMin: number;
  status: "requested" | "unconfirmed" | "confirmed";
  source: "manual" | "online";
  notes: string | null;
  lines: PriceLine[];
  seriesId?: string | null;
};

/**
 * Creates a visit at one home with its price lines, copying the home's address onto the
 * visit (the client may move later; history stays). Every way of booking goes through here.
 */
export async function insertAppointment(tx: TransactionSql, a: NewAppointment) {
  const [home] = await tx`
    select h.address_line, h.city, h.state, h.zip, h.lat, h.lng from homes h
    where h.id = ${a.homeId} and h.client_id = ${a.clientId}`;
  if (!home) throw new Error("Home not found for this client");
  const address = [home.address_line, home.city, home.state].filter(Boolean).join(", ") || null;
  const endAt = new Date(a.startAt.getTime() + a.durationMin * 60_000);
  const [appt] = await tx`
    insert into appointments (business_id, client_id, staff_id, series_id, start_at, end_at, status, source,
                              address_line, zip, lat, lng, notes, service_id, frequency)
    values (${a.businessId}, ${a.clientId}, ${a.staffId}, ${a.seriesId ?? null}, ${a.startAt}, ${endAt}, ${a.status},
            ${a.source}, ${address}, ${home.zip}, ${home.lat}, ${home.lng}, ${a.notes}, ${a.serviceId}, ${a.frequency})
    returning id`;
  const [ah] = await tx`insert into appointment_homes (appointment_id, home_id) values (${appt.id}, ${a.homeId}) returning id`;
  for (const l of a.lines) {
    await tx`insert into appointment_lines (appointment_home_id, service_id, kind, name, qty, price_cents, duration_min)
             values (${ah.id}, ${l.serviceId}, ${l.kind}, ${l.label}, ${l.qty}, ${l.amountCents},
                     ${l.kind === "service" ? a.durationMin : 0})`;
  }
  return appt.id as string;
}
