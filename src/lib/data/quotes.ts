import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { isUuid } from "../format";

// Quote requests: Airbnb turnovers and offices, which are priced by hand. The owner replies
// by email or phone, then archives the request or turns it into a client and a booking.

export type QuoteKind = "airbnb" | "office";
export type QuoteStatus = "new" | "replied" | "converted" | "archived";
export const QUOTE_KIND_LABEL: Record<QuoteKind, string> = { airbnb: "Airbnb / short-term rental", office: "Office" };

export type QuoteRow = {
  id: string;
  kind: QuoteKind;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string | null;
  zip: string | null;
  bedrooms: number | null;
  full_baths: number | null;
  square_feet: number | null;
  frequency: string | null;
  message: string;
  status: QuoteStatus;
  client_id: string | null;
  created_at: Date;
  photo_ids: string[];
};

const select = sql`
  select q.*, coalesce((select array_agg(p.id order by p.created_at) from quote_request_photos p
                        where p.quote_request_id = q.id), '{}') as photo_ids
  from quote_requests q`;

/** Open requests (new and replied), or the closed ones (converted and archived). */
export function listQuotes(staff: StaffContext, open = true) {
  return sql<QuoteRow[]>`
    ${select}
    where q.business_id = ${staff.businessId}
      and q.status = any(${open ? ["new", "replied"] : ["converted", "archived"]})
    order by q.created_at desc limit 200`;
}

export async function countNewQuotes(staff: StaffContext) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from quote_requests where business_id = ${staff.businessId} and status = 'new'`;
  return n;
}

export async function getQuote(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await sql<QuoteRow[]>`${select} where q.id = ${id} and q.business_id = ${staff.businessId}`;
  return row ?? null;
}

export async function setQuoteStatus(staff: StaffContext, id: string, status: QuoteStatus) {
  if (!isUuid(id)) return;
  await sql`update quote_requests set status = ${status} where id = ${id} and business_id = ${staff.businessId}`;
}

/**
 * Makes (or finds, by phone) the client for a quote request, with their place as a home when
 * the size is known, and marks the request converted. Returns the client and home ids.
 */
export async function convertQuote(staff: StaffContext, id: string) {
  const q = await getQuote(staff, id);
  if (!q) return null;
  return sql.begin(async (tx) => {
    const [known] = await tx`select id from clients where business_id = ${staff.businessId} and phone = ${q.phone}`;
    const clientId: string = known
      ? known.id
      : (
          await tx`
            insert into clients (business_id, first_name, last_name, phone, email, city, state, zip, source)
            values (${staff.businessId}, ${q.first_name}, ${q.last_name}, ${q.phone}, ${q.email}, ${q.city}, 'CA', ${q.zip}, 'online')
            returning id`
        )[0].id;
    const [home] = await tx`
      insert into homes (client_id, label, city, state, zip, bedrooms, full_baths, notes)
      values (${clientId}, ${q.kind === "office" ? "Office" : "Rental"}, ${q.city}, 'CA', ${q.zip},
              ${Math.min(Math.max(q.bedrooms ?? 1, 0), 7)}, ${Math.min(Math.max(q.full_baths ?? 1, 1), 7)},
              ${[q.square_feet ? `${q.square_feet} sq ft` : null, q.message].filter(Boolean).join("\n") || null})
      returning id`;
    await tx`update quote_requests set status = 'converted', client_id = ${clientId} where id = ${id}`;
    return { clientId, homeId: home.id as string };
  });
}
