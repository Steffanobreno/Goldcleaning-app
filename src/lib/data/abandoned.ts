import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { isUuid } from "../format";

// Abandoned online bookings: someone started on the booking page and stopped for more than
// 20 minutes. Status: Recovered once that phone has a visit booked after it (online, by text,
// or by the owner); Contacted once the "finish booking" message went out or the owner texted
// or called from the app; otherwise Abandoned. Finishing in one go doesn't count as abandoned.

export type DraftStatus = "abandoned" | "contacted" | "recovered";
export type DraftPet = { name: string; breed: string; size: string; service: string; addons: string[] };
export type Draft = {
  id: string; phone: string; first_name: string | null; last_name: string | null; email: string | null;
  address_line: string | null; city: string | null; zip: string | null; pets: string | null; pet_details: DraftPet[] | null;
  step: string; chosen_start: Date | null; created_at: Date; updated_at: Date; reminded_at: Date | null;
  contacted_at: Date | null; client_id: string | null; booked_id: string | null; status: DraftStatus; revenue_cents: number;
};

const drafts = (staff: StaffContext, extra = sql``, limit = 500) => sql<Draft[]>`
  with d as (
    select d.*,
      (select a.id from appointments a join clients c on c.id = a.client_id
        where c.business_id = d.business_id and c.phone = d.phone and a.created_at > d.created_at
          and a.status not in ('declined', 'cancelled')
        order by a.created_at limit 1) as booked_id
    from booking_drafts d
    where d.business_id = ${staff.businessId} and d.dismissed_at is null
      and d.updated_at < now() - interval '20 minutes'
      and not (d.completed_at is not null and d.completed_at < d.updated_at + interval '20 minutes'
               and d.reminded_at is null and d.contacted_at is null))
  select d.id, d.phone, d.first_name, d.last_name, d.email, d.address_line, d.city, d.zip, d.pets, d.pet_details, d.step,
    d.chosen_start, d.created_at, d.updated_at, d.reminded_at, d.contacted_at, d.client_id, d.booked_id,
    case when d.booked_id is not null then 'recovered'
         when d.reminded_at is not null or d.contacted_at is not null then 'contacted'
         else 'abandoned' end as status,
    coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
              where ap.appointment_id = d.booked_id), 0)::int as revenue_cents
  from d where true ${extra}
  order by d.updated_at desc
  limit ${limit}`;

export function listDrafts(staff: StaffContext, status: DraftStatus | null, days = 90) {
  return drafts(staff, sql`and d.updated_at > now() - make_interval(days => ${days})
    ${status ? sql`and (case when d.booked_id is not null then 'recovered'
                             when d.reminded_at is not null or d.contacted_at is not null then 'contacted'
                             else 'abandoned' end) = ${status}` : sql``}`, 200);
}

export async function getDraft(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await drafts(staff, sql`and d.id = ${id}`);
  return row ?? null;
}

/** Last 30 days: how many abandoned, how many came back, and what those visits are worth. */
export async function draftStats(staff: StaffContext) {
  const rows = await drafts(staff, sql`and d.updated_at > now() - interval '30 days'`);
  const recovered = rows.filter((r) => r.status === "recovered");
  return { abandoned: rows.length, recovered: recovered.length, revenue: recovered.reduce((s, r) => s + r.revenue_cents, 0) };
}

export const STEP_NAMES: Record<string, string> = {
  phone: "Phone number",
  contact: "Name and email",
  address: "Address",
  times: "Select time",
  review: "Review and sign",
};
