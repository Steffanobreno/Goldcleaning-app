import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { dayRangeUtc } from "../format";

// Money and work for a date range (inclusive, in the business time zone).
// "Expected" counts the services on visits that weren't cancelled or no-shows;
// "collected" is what payments recorded at checkout add up to, by the day they came in.

export type Group = "day" | "week" | "month";

const LIVE = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];

export async function report(staff: StaffContext, from: string, to: string, group: Group) {
  const start = dayRangeUtc(from, staff.timezone).start;
  const end = dayRangeUtc(to, staff.timezone).end;
  const tz = staff.timezone;
  const biz = staff.businessId;

  const [totals, payments, methods, services, buckets, topClients, newClients] = await Promise.all([
    sql<{ appts: number; finished: number; cancelled: number; no_show: number; pets: number; dogs_done: number;
          clients: number; expected: number; unpaid: number }[]>`
      with a as (
        select a.id, a.client_id, a.status,
          coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
                    where ap.appointment_id = a.id), 0) as price,
          (select count(*) from appointment_pets ap where ap.appointment_id = a.id) as pets,
          exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid
        from appointments a
        where a.business_id = ${biz} and a.start_at >= ${start} and a.start_at < ${end}
          and a.status not in ('declined', 'waitlist'))
      select count(*) filter (where status = any(${LIVE}))::int as appts,
             count(*) filter (where status = 'completed')::int as finished,
             count(*) filter (where status = 'cancelled')::int as cancelled,
             count(*) filter (where status = 'no_show')::int as no_show,
             coalesce(sum(pets) filter (where status = any(${LIVE})), 0)::int as pets,
             coalesce(sum(pets) filter (where status = 'completed'), 0)::int as dogs_done,
             count(distinct client_id) filter (where status = any(${LIVE}))::int as clients,
             coalesce(sum(price) filter (where status = any(${LIVE})), 0)::int as expected,
             coalesce(sum(price) filter (where status = 'completed' and not paid), 0)::int as unpaid
      from a`,
    sql<{ collected: number; tips: number; count: number }[]>`
      select coalesce(sum(p.amount_cents), 0)::int as collected, coalesce(sum(p.tip_cents), 0)::int as tips, count(*)::int as count
      from payments p join invoices i on i.id = p.invoice_id
      where i.business_id = ${biz} and p.received_at >= ${start} and p.received_at < ${end}`,
    sql<{ method: string; amount: number; tips: number }[]>`
      select p.method, sum(p.amount_cents)::int as amount, sum(p.tip_cents)::int as tips
      from payments p join invoices i on i.id = p.invoice_id
      where i.business_id = ${biz} and p.received_at >= ${start} and p.received_at < ${end}
      group by p.method order by sum(p.amount_cents + p.tip_cents) desc`,
    sql<{ name: string; count: number; revenue: number }[]>`
      select s.name, count(*)::int as count, sum(s.price_cents)::int as revenue
      from appointments a join appointment_pets ap on ap.appointment_id = a.id
      join appointment_services s on s.appointment_pet_id = ap.id
      where a.business_id = ${biz} and a.start_at >= ${start} and a.start_at < ${end} and a.status = any(${LIVE})
      group by s.name order by sum(s.price_cents) desc, count(*) desc limit 15`,
    // One row per day/week/month: visits and dogs by visit date, money by payment date.
    sql<{ bucket: string; appts: number; dogs: number; expected: number; collected: number }[]>`
      with v as (
        select to_char(date_trunc(${group}, a.start_at at time zone ${tz}), 'YYYY-MM-DD') as bucket,
               count(*)::int as appts,
               sum((select count(*) from appointment_pets ap where ap.appointment_id = a.id))::int as dogs,
               sum(coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
                             where ap.appointment_id = a.id), 0))::int as expected
        from appointments a
        where a.business_id = ${biz} and a.start_at >= ${start} and a.start_at < ${end} and a.status = any(${LIVE})
        group by 1),
      m as (
        select to_char(date_trunc(${group}, p.received_at at time zone ${tz}), 'YYYY-MM-DD') as bucket,
               sum(p.amount_cents + p.tip_cents)::int as collected
        from payments p join invoices i on i.id = p.invoice_id
        where i.business_id = ${biz} and p.received_at >= ${start} and p.received_at < ${end}
        group by 1)
      select coalesce(v.bucket, m.bucket) as bucket, coalesce(v.appts, 0) as appts, coalesce(v.dogs, 0) as dogs,
             coalesce(v.expected, 0) as expected, coalesce(m.collected, 0) as collected
      from v full join m on m.bucket = v.bucket
      order by 1`,
    sql<{ id: string; name: string; visits: number; spent: number }[]>`
      select c.id, trim(c.first_name || ' ' || c.last_name) as name, count(distinct i.id)::int as visits,
             sum(p.amount_cents + p.tip_cents)::int as spent
      from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = i.client_id
      where i.business_id = ${biz} and p.received_at >= ${start} and p.received_at < ${end}
      group by c.id order by spent desc limit 10`,
    sql<{ n: number }[]>`
      select count(*)::int as n from clients
      where business_id = ${biz} and created_at >= ${start} and created_at < ${end} and source <> 'import'`,
  ]);

  return {
    ...totals[0],
    collected: payments[0].collected,
    tips: payments[0].tips,
    paymentsCount: payments[0].count,
    newClients: newClients[0].n,
    methods,
    services,
    buckets,
    topClients,
  };
}
