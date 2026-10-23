import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { isUuid } from "../format";
import type { Frequency } from "../pricing";

export type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  sms_consent_at: Date | null;
  imported_last_service_at: Date | null;
  sms_opted_out_at: Date | null;
  archived_at: Date | null;
  online_booking_blocked: boolean;
  email_unsubscribed_at: Date | null;
  created_at: Date;
  imported_total_sales_cents: number | null;
};

export const fullName = (c: { first_name: string; last_name: string }) =>
  `${c.first_name} ${c.last_name}`.trim();

export const fullAddress = (c: Pick<ClientRow, "address_line" | "city" | "state" | "zip">) =>
  [c.address_line, c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export async function listClients(staff: StaffContext, q: string, inactive = false) {
  const term = q.trim();
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  return sql<(ClientRow & { home_summary: string | null; is_new: boolean })[]>`
    select c.*, (select string_agg(
                   case when h.bedrooms = 0 then 'Studio' else h.bedrooms || ' bd' end || ' / ' || h.full_baths || ' ba'
                   || coalesce(' · ' || h.city, ''), ', ' order by h.created_at) from homes h
                 where h.client_id = c.id and h.archived_at is null) as home_summary,
      -- "New": no finished visit yet, here or in the old app.
      (c.imported_last_service_at is null and not exists (
         select 1 from appointments a where a.client_id = c.id and a.status = 'completed')) as is_new
    from clients c
    where c.business_id = ${staff.businessId} and (c.archived_at is not null) = ${inactive}
      and (${term} = ''
           or c.first_name || ' ' || c.last_name ilike ${like}
           or (${digits} <> '' and c.phone like ${"%" + digits + "%"})
           or exists (select 1 from homes h where h.client_id = c.id and h.archived_at is null
                      and (h.address_line ilike ${like} or h.city ilike ${like} or h.zip = ${term})))
    order by c.first_name, c.last_name
    limit 1000`;
}

/** How many clients and homes the business has (the counts on top of the client list). */
export async function clientCounts(staff: StaffContext) {
  const [row] = await sql<{ clients: number; homes: number }[]>`
    select (select count(*) from clients where business_id = ${staff.businessId} and archived_at is null)::int as clients,
           (select count(*) from homes h join clients c on c.id = h.client_id
             where c.business_id = ${staff.businessId} and c.archived_at is null and h.archived_at is null)::int as homes`;
  return row;
}

export async function getClient(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [client] = await sql<ClientRow[]>`
    select * from clients where id = ${id} and business_id = ${staff.businessId}`;
  return client ?? null;
}

export async function listClientNotes(staff: StaffContext, clientId: string) {
  return sql<{ id: string; body: string; created_at: Date; staff_name: string | null }[]>`
    select n.id, n.body, n.created_at, s.name as staff_name
    from client_notes n join clients c on c.id = n.client_id
    left join staff s on s.id = n.staff_id
    where n.client_id = ${clientId} and c.business_id = ${staff.businessId}
    order by n.created_at desc`;
}

export async function clientHistory(staff: StaffContext, clientId: string) {
  return sql<{ id: string; start_at: Date; status: string; total_cents: number; service_name: string | null; frequency: Frequency; paid: boolean; upcoming: boolean }[]>`
    select a.id, a.start_at, a.status, a.frequency,
      (a.start_at >= now() and a.status not in ('cancelled', 'no_show', 'declined')) as upcoming,
      coalesce((select sum(l.price_cents) from appointment_homes ah
                join appointment_lines l on l.appointment_home_id = ah.id
                where ah.appointment_id = a.id), 0)::int as total_cents,
      (select sv.name from services sv where sv.id = a.service_id) as service_name,
      exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid
    from appointments a
    where a.client_id = ${clientId} and a.business_id = ${staff.businessId}
    order by a.start_at desc
    limit 50`;
}


/** Money and habits for the client profile: what they paid here, what's open, how often they come. */
export async function clientSummary(staff: StaffContext, clientId: string) {
  const [[money], payments, gaps] = await Promise.all([
    sql<{ paid: number; tips: number; unpaid: number }[]>`
      select coalesce((select sum(p.amount_cents) from payments p join invoices i on i.id = p.invoice_id
                       where i.client_id = ${clientId} and i.business_id = ${staff.businessId}), 0)::int as paid,
             coalesce((select sum(p.tip_cents) from payments p join invoices i on i.id = p.invoice_id
                       where i.client_id = ${clientId} and i.business_id = ${staff.businessId}), 0)::int as tips,
             coalesce((select sum(greatest(i.total_cents - i.paid_cents, 0)) from invoices i
                       where i.client_id = ${clientId} and i.business_id = ${staff.businessId} and i.status = 'open'), 0)::int
             + coalesce((select sum(l.price_cents) from appointments a join appointment_homes ah on ah.appointment_id = a.id
                         join appointment_lines l on l.appointment_home_id = ah.id
                         where a.client_id = ${clientId} and a.business_id = ${staff.businessId} and a.status = 'completed'
                           and not exists (select 1 from invoices i where i.appointment_id = a.id)), 0)::int as unpaid`,
    sql<{ id: string; received_at: Date; method: string; amount_cents: number; tip_cents: number; appointment_id: string | null }[]>`
      select p.id, p.received_at, p.method, p.amount_cents, p.tip_cents, i.appointment_id
      from payments p join invoices i on i.id = p.invoice_id
      where i.client_id = ${clientId} and i.business_id = ${staff.businessId}
      order by p.received_at desc limit 20`,
    // Days between finished visits, for the "actual frequency".
    sql<{ avg_days: number | null }[]>`
      select round(avg(gap))::int as avg_days from (
        select extract(epoch from start_at - lag(start_at) over (order by start_at)) / 86400 as gap
        from appointments where client_id = ${clientId} and business_id = ${staff.businessId} and status = 'completed') g
      where gap is not null`,
  ]);
  return { ...money, payments, actualDays: gaps[0]?.avg_days ?? null };
}
