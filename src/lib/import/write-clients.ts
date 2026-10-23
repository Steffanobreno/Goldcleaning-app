// Writes parsed clients into the database. Takes the connection as a parameter so the
// import page (app pool) and the command-line script (own connection) can both use it.
// Everything is written with a few bulk inserts inside one transaction: the hosted app has
// about 10 seconds per request, and one round trip per row would not fit.
import type { Sql } from "postgres";
import { fromZonedTime } from "date-fns-tz";
import type { ImportedClient } from "./clients-csv";

export type ImportReport = {
  created: number;
  existing: number;
  homes: number;
  appointments: number;
  problems: string[];
  moreUpcoming: string[]; // clients with more than one upcoming visit: only the next one comes over
};

const IMPORTED_NOTE = "Imported from the old app. Set the price (Edit price) before checkout.";

export async function writeClients(
  sql: Sql,
  target: { businessId: string; staffId: string; timezone: string },
  clients: ImportedClient[],
  options: { appointments: boolean },
): Promise<ImportReport> {
  const report: ImportReport = { created: 0, existing: 0, homes: 0, appointments: 0, problems: [], moreUpcoming: [] };
  const local = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, target.timezone);
  const now = Date.now();

  await sql.begin(async (tx) => {
    const phones = clients.map((c) => c.phone);
    const existing = new Set(
      (await tx`select phone from clients where business_id = ${target.businessId} and phone = any(${phones})`).map((r) => r.phone),
    );
    const fresh = clients.filter((c) => !existing.has(c.phone));
    report.existing = clients.length - fresh.length;
    if (fresh.length === 0) return;

    // 1. Clients.
    const inserted = await tx`
      insert into clients ${tx(
        fresh.map((c) => ({
          business_id: target.businessId,
          first_name: c.firstName,
          last_name: c.lastName,
          phone: c.phone,
          email: c.email,
          address_line: c.addressLine,
          city: c.city,
          state: c.state,
          zip: c.zip,
          lat: c.lat,
          lng: c.lng,
          marketing_opt_in: c.marketing,
          source: "import",
          imported_last_service_at: c.lastService ? local(c.lastService.date, c.lastService.start) : null,
          imported_total_sales_cents: c.totalSalesCents,
        })),
      )}
      returning id, phone`;
    const idByPhone = new Map(inserted.map((r) => [r.phone as string, r.id as string]));
    report.created = inserted.length;

    // 2. Notes.
    const notes = fresh.flatMap((c) =>
      c.notes.map((body) => ({ client_id: idByPhone.get(c.phone)!, staff_id: target.staffId, body })),
    );
    if (notes.length) await tx`insert into client_notes ${tx(notes)}`;

    // 3. One home per client, at their address.
    const homes = await tx`
      insert into homes ${tx(
        fresh.map((c) => ({
          client_id: idByPhone.get(c.phone)!,
          address_line: c.addressLine,
          city: c.city,
          state: c.state,
          zip: c.zip,
          lat: c.lat,
          lng: c.lng,
          bedrooms: c.home.bedrooms,
          full_baths: c.home.fullBaths,
          half_baths: c.home.halfBaths,
        })),
      )}
      returning id, client_id`;
    report.homes = homes.length;
    const homeByClient = new Map(homes.map((h) => [h.client_id as string, h.id as string]));

    // 4. Each client's next visit (only future ones), at their home. The price is set later.
    if (!options.appointments) return;
    const visits = fresh.flatMap((c) => {
      if (!c.next) return [];
      const start = local(c.next.date, c.next.start);
      let end = local(c.next.date, c.next.end);
      if (end <= start) end = new Date(start.getTime() + 120 * 60_000);
      if (start.getTime() <= now) return [];
      if (c.upcomingCount > 1) report.moreUpcoming.push(`${`${c.firstName} ${c.lastName}`.trim()} (${c.upcomingCount} upcoming)`);
      return [
        {
          business_id: target.businessId,
          client_id: idByPhone.get(c.phone)!,
          staff_id: target.staffId,
          start_at: start,
          end_at: end,
          status: "unconfirmed",
          source: "manual",
          address_line: [c.addressLine, c.city, c.state].filter(Boolean).join(", ") || null,
          zip: c.zip,
          lat: c.lat,
          lng: c.lng,
          notes: IMPORTED_NOTE,
        },
      ];
    });
    if (visits.length === 0) return;
    const appts = await tx`insert into appointments ${tx(visits)} returning id, client_id`;
    report.appointments = appts.length;
    await tx`insert into appointment_homes ${tx(appts.map((a) => ({ appointment_id: a.id, home_id: homeByClient.get(a.client_id)! })))}`;
  });
  return report;
}
