import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { dayRangeUtc } from "../format";

// The line-by-line detail behind Reports, for the PDF and CSV export: every payment, every visit,
// the checkouts closed (discounts, tax, tips), and the totals by cleaner.

export async function reportDetails(staff: StaffContext, from: string, to: string) {
  const start = dayRangeUtc(from, staff.timezone).start;
  const end = dayRangeUtc(to, staff.timezone).end;
  const tz = staff.timezone;
  const biz = staff.businessId;
  const [payments, visits, checkouts, groomers] = await Promise.all([
    sql<{ received: string; receipt_no: number | null; client: string; visit: string | null; method: string; reference: string | null;
          amount: number; tip: number; taken_by: string | null }[]>`
      select to_char(p.received_at at time zone ${tz}, 'YYYY-MM-DD HH24:MI') as received, i.receipt_no,
             trim(c.first_name || ' ' || c.last_name) as client,
             to_char(a.start_at at time zone ${tz}, 'YYYY-MM-DD') as visit,
             p.method, p.reference, p.amount_cents as amount, p.tip_cents as tip, s.name as taken_by
      from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = i.client_id
      left join appointments a on a.id = i.appointment_id left join staff s on s.id = p.staff_id
      where i.business_id = ${biz} and p.received_at >= ${start} and p.received_at < ${end}
      order by p.received_at`,
    sql<{ date: string; time: string; client: string; city: string | null; services: string; groomer: string;
          status: string; price: number; invoice: string | null; paid: number }[]>`
      select to_char(a.start_at at time zone ${tz}, 'YYYY-MM-DD') as date, to_char(a.start_at at time zone ${tz}, 'HH24:MI') as time,
             trim(c.first_name || ' ' || c.last_name) as client, c.city,
             coalesce((select string_agg(l.name, ', ' order by l.created_at, l.id) from appointment_homes ah
                       join appointment_lines l on l.appointment_home_id = ah.id and l.kind in ('service', 'extra')
                       where ah.appointment_id = a.id), '') as services,
             st.name as groomer, a.status,
             coalesce((select sum(l.price_cents) from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
                       where ah.appointment_id = a.id), 0)::int as price,
             i.status as invoice, coalesce(i.paid_cents, 0) as paid
      from appointments a join clients c on c.id = a.client_id join staff st on st.id = a.staff_id
      left join invoices i on i.appointment_id = a.id
      where a.business_id = ${biz} and a.start_at >= ${start} and a.start_at < ${end} and a.status not in ('declined', 'waitlist')
      order by a.start_at`,
    sql<{ count: number; subtotal: number; discount: number; tax: number; tips: number; total: number }[]>`
      select count(*)::int as count, coalesce(sum(subtotal_cents), 0)::int as subtotal, coalesce(sum(discount_cents), 0)::int as discount,
             coalesce(sum(tax_cents), 0)::int as tax, coalesce(sum(tip_cents), 0)::int as tips, coalesce(sum(total_cents), 0)::int as total
      from invoices where business_id = ${biz} and status = 'closed' and closed_at >= ${start} and closed_at < ${end}`,
    sql<{ name: string; visits: number; expected: number; collected: number; tips: number }[]>`
      with v as (
        select a.staff_id, count(*)::int as visits,
               sum(coalesce((select sum(l.price_cents) from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
                             where ah.appointment_id = a.id), 0))::int as expected
        from appointments a
        where a.business_id = ${biz} and a.start_at >= ${start} and a.start_at < ${end}
          and a.status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed')
        group by a.staff_id),
      m as (
        select a.staff_id, sum(p.amount_cents)::int as collected, sum(p.tip_cents)::int as tips
        from payments p join invoices i on i.id = p.invoice_id join appointments a on a.id = i.appointment_id
        where i.business_id = ${biz} and p.received_at >= ${start} and p.received_at < ${end}
        group by a.staff_id)
      select s.name, coalesce(v.visits, 0) as visits, coalesce(v.expected, 0) as expected,
             coalesce(m.collected, 0) as collected, coalesce(m.tips, 0) as tips
      from staff s left join v on v.staff_id = s.id left join m on m.staff_id = s.id
      where s.business_id = ${biz} and (v.staff_id is not null or m.staff_id is not null)
      order by coalesce(m.collected, 0) + coalesce(v.expected, 0) desc`,
  ]);
  return { payments, visits, checkouts: checkouts[0], groomers };
}
