import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { todayYmd } from "../format";

// Clients waiting for a day that's full, and the spots that opened for them (a visit on one of
// their days was cancelled in the last two weeks and the day is still ahead).

export type WaitlistEntry = {
  id: string; client_id: string; client: string; phone: string; email: string | null; homes: string | null;
  from_date: string; to_date: string; note: string | null;
};
export type Opening = { entry_id: string; date: string; start_at: Date; end_at: Date; cancelled_client: string };

export async function listWaitlist(staff: StaffContext) {
  const today = todayYmd(staff.timezone);
  return sql<WaitlistEntry[]>`
    select w.id, w.client_id, trim(c.first_name || ' ' || c.last_name) as client, c.phone, c.email,
           (select string_agg(case when h.bedrooms = 0 then 'Studio' else h.bedrooms || ' bd' end || ' / ' || h.full_baths || ' ba'
                              || coalesce(' · ' || h.city, ''), ', ' order by h.created_at)
            from homes h where h.client_id = c.id and h.archived_at is null) as homes,
           to_char(w.from_date, 'YYYY-MM-DD') as from_date, to_char(w.to_date, 'YYYY-MM-DD') as to_date, w.note
    from waitlist w join clients c on c.id = w.client_id
    where w.business_id = ${staff.businessId} and w.status = 'waiting' and w.to_date >= ${today}
    order by w.from_date, w.created_at`;
}

/** Cancelled visits (last 14 days, still ahead) on a day someone on the waitlist wants. */
export async function waitlistOpenings(staff: StaffContext) {
  const tz = staff.timezone;
  return sql<Opening[]>`
    select w.id as entry_id, to_char(a.start_at at time zone ${tz}, 'YYYY-MM-DD') as date, a.start_at, a.end_at,
           trim(c.first_name || ' ' || c.last_name) as cancelled_client
    from waitlist w
    join appointments a on a.business_id = w.business_id and a.status = 'cancelled'
      and a.cancelled_at > now() - interval '14 days' and a.start_at > now()
      and (a.start_at at time zone ${tz})::date between w.from_date and w.to_date
      and a.client_id <> w.client_id
    join clients c on c.id = a.client_id
    where w.business_id = ${staff.businessId} and w.status = 'waiting'
      -- Still free: nothing else booked over that time since.
      and not exists (select 1 from appointments b where b.staff_id = a.staff_id and b.id <> a.id
                        and b.status not in ('cancelled', 'no_show', 'declined', 'waitlist')
                        and b.start_at < a.end_at and b.end_at > a.start_at)
    order by a.start_at`;
}

/** Booking a client takes them off the waitlist for that day. */
export async function bookedFromWaitlist(businessId: string, clientId: string, day: string) {
  await sql`update waitlist set status = 'booked'
            where business_id = ${businessId} and client_id = ${clientId} and status = 'waiting'
              and ${day}::date between from_date and to_date`;
}
