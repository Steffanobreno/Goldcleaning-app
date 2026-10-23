import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { sql } from "./db";

// Every client with their home size as a CSV, in the same columns the importer reads,
// so an export can be imported again (or opened in Excel / Google Sheets).

const cell = (v: unknown) => {
  // A name typed as "=HYPERLINK(...)" must not run as a formula in Excel / Sheets.
  const s = v == null ? "" : String(v).replace(/^[=+\-@\t\r]/, "'$&");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function clientsCsv(businessId: string, tz: string) {
  const rows = await sql<
    { first_name: string; last_name: string; email: string | null; phone: string; address_line: string | null; city: string | null;
      state: string | null; zip: string | null; lat: number | null; lng: number | null; bedrooms: number | null; full_baths: number | null; half_baths: number | null;
      last_visit: Date | null; next_visit: Date | null; next_end: Date | null; notes: string | null; created_at: Date }[]
  >`
    select c.first_name, c.last_name, c.email, c.phone, c.address_line, c.city, c.state, c.zip, c.lat, c.lng, c.created_at,
      h.bedrooms, h.full_baths, h.half_baths,
      greatest(c.imported_last_service_at,
        (select max(a.start_at) from appointments a where a.client_id = c.id and a.status = 'completed')) as last_visit,
      (select min(a.start_at) from appointments a where a.client_id = c.id and a.start_at > now()
         and a.status in ('requested', 'unconfirmed', 'confirmed')) as next_visit,
      (select a.end_at from appointments a where a.client_id = c.id and a.start_at > now()
         and a.status in ('requested', 'unconfirmed', 'confirmed') order by a.start_at limit 1) as next_end,
      (select string_agg(n.body, ' | ' order by n.created_at) from client_notes n where n.client_id = c.id) as notes
    from clients c
    left join lateral (select bedrooms, full_baths, half_baths from homes
                       where client_id = c.id and archived_at is null order by created_at limit 1) h on true
    where c.business_id = ${businessId} and c.archived_at is null
    order by c.first_name, c.last_name`;

  const header = ["First name", "Last name", "email", "Primary contact", "address", "Bedrooms", "Bathrooms", "Half baths",
    "Last service", "Next service", "notes", "latitude, longitude of the address", "create date"];
  const slot = (start: Date | null, end?: Date | null) =>
    start ? `${formatInTimeZone(start, tz, "yyyy-MM-dd HH:mm")}${end ? "-" + formatInTimeZone(end, tz, "HH:mm") : ""}` : "";
  const lines = rows.map((r) =>
    [
      r.first_name,
      r.last_name,
      r.email,
      r.phone.replace(/^\+1/, ""),
      [r.address_line, r.city, r.state, "US", r.zip].filter(Boolean).join(", "),
      r.bedrooms,
      r.full_baths,
      r.half_baths,
      slot(r.last_visit),
      slot(r.next_visit, r.next_end),
      r.notes,
      r.lat != null && r.lng != null ? `${r.lat}, ${r.lng}` : "",
      formatInTimeZone(r.created_at, tz, "yyyy-MM-dd HH:mm:ss"),
    ]
      .map(cell)
      .join(","),
  );
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
  return csv;
}
