import "server-only";
import type { StaffContext } from "../auth";
import { isExclusionViolation, sql } from "../db";
import { hm, ymd, zonedToUtc } from "../format";
import { repeatDates, type RepeatRule } from "../repeat";

// Repeating a visit: books copies of it (same time, home and price lines, except a coupon, which is for the first visit only) on every date of the
// rule. Changing the rule replaces the later copies that are still just booked; visits the
// client confirmed, checked in or paid are left alone. A date that is taken is skipped and
// reported, so the owner can book that one at another time.

export type SeriesResult = { error: string } | { created: number; skipped: { date: string; reason: string }[] };

const LIVE = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];

/** Later copies in this visit's series that can still be replaced: not confirmed one by one, not paid. */
export async function replaceable(staff: StaffContext, a: { id: string; series_id: string | null; start_at: Date }) {
  if (!a.series_id) return [] as string[];
  const rows = await sql<{ id: string }[]>`
    select x.id from appointments x
    where x.business_id = ${staff.businessId} and x.series_id = ${a.series_id} and x.start_at > ${a.start_at}
      -- a visit the client (or the owner, one by one) confirmed stays; copies booked with a series don't count
      and (x.status = 'unconfirmed' or (x.status = 'confirmed' and x.confirmed_at is null))
      and not exists (select 1 from invoices i where i.appointment_id = x.id)`;
  return rows.map((r) => r.id);
}

/** Books the visit's copies on every later date of the rule (see above). */
export async function bookSeries(
  staff: StaffContext,
  appointmentId: string,
  rule: RepeatRule,
  status: "unconfirmed" | "confirmed" = "unconfirmed", // an accepted recurring request books its copies confirmed
): Promise<SeriesResult> {
  const tz = staff.timezone;
  const [a] = await sql<{ id: string; client_id: string; staff_id: string; start_at: Date; end_at: Date; status: string; series_id: string | null;
                         address_line: string | null; zip: string | null; lat: number | null; lng: number | null; notes: string | null;
                         service_id: string | null; frequency: string }[]>`
    select id, client_id, staff_id, start_at, end_at, status, series_id, address_line, zip, lat, lng, notes, service_id, frequency
    from appointments
    where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!a) return { error: "Appointment not found." };
  if (!LIVE.includes(a.status) || a.status === "requested") return { error: "Accept the visit before repeating it." };

  const first = ymd(a.start_at, tz);
  const time = hm(a.start_at, tz);
  const length = a.end_at.getTime() - a.start_at.getTime();
  const dates = repeatDates(first, rule).slice(1);
  if (dates.length === 0) return { error: "That rule has no dates after this visit." };
  const ranges = dates.map((d) => {
    const s = zonedToUtc(d, time, tz);
    return { date: d, s, e: new Date(s.getTime() + length) };
  });
  const old = await replaceable(staff, a);

  // What's in the way on each date: another visit (not one being replaced) or blocked time.
  const busy = await sql<{ i: number; visit: string | null; block: string | null }[]>`
    select r.i::int as i,
      (select c.first_name || '''s visit' from appointments x join clients c on c.id = x.client_id
        where x.staff_id = ${a.staff_id} and x.status = any(${LIVE}) and x.id <> ${a.id} and not (x.id = any(${old}::uuid[]))
          and x.start_at < r.e and x.end_at > r.s limit 1) as visit,
      (select coalesce(t.reason, 'Blocked time') from time_off t
        where t.staff_id = ${a.staff_id} and t.start_at < r.e and t.end_at > r.s limit 1) as block
    from unnest(${ranges.map((r) => r.s.toISOString())}::timestamptz[], ${ranges.map((r) => r.e.toISOString())}::timestamptz[])
      with ordinality as r(s, e, i)`;
  const reasonAt = new Map(busy.map((b) => [b.i - 1, b.visit ?? b.block]));

  const homes = await sql<{ home_id: string; lines: { service_id: string | null; kind: string; name: string; qty: number;
                                                   price_cents: number; duration_min: number; discount_id: string | null }[] }[]>`
    select ah.home_id,
      coalesce((select json_agg(json_build_object('service_id', l.service_id, 'kind', l.kind, 'name', l.name, 'qty', l.qty,
                                                  'price_cents', l.price_cents, 'duration_min', l.duration_min, 'discount_id', l.discount_id) order by l.created_at, l.id)
                from appointment_lines l where l.appointment_home_id = ah.id and l.kind <> 'coupon'), '[]'::json) as lines
    from appointment_homes ah where ah.appointment_id = ${a.id}`;

  const skipped: { date: string; reason: string }[] = [];
  let created = 0;
  await sql.begin(async (tx) => {
    if (old.length) await tx`delete from appointments where id = any(${old}::uuid[])`;
    const [series] = await tx`
      insert into appointment_series (business_id, freq, interval_n, ends_on, occurrences)
      values (${staff.businessId}, ${rule.freq}, ${rule.every}, ${rule.until}, ${rule.count})
      returning id`;
    await tx`update appointments set series_id = ${series.id}, updated_at = now() where id = ${a.id}`;
    for (const [i, r] of ranges.entries()) {
      const reason = reasonAt.get(i);
      if (reason) {
        skipped.push({ date: r.date, reason });
        continue;
      }
      try {
        await tx.savepoint(async (sp) => {
          const [copy] = await sp`
            insert into appointments (business_id, client_id, staff_id, series_id, start_at, end_at, status, source,
                                      address_line, zip, lat, lng, notes, service_id, frequency)
            values (${staff.businessId}, ${a.client_id}, ${a.staff_id}, ${series.id}, ${r.s}, ${r.e}, ${status}, 'manual',
                    ${a.address_line}, ${a.zip}, ${a.lat}, ${a.lng}, ${a.notes}, ${a.service_id}, ${a.frequency})
            returning id`;
          for (const h of homes) {
            const [ah] = await sp`insert into appointment_homes (appointment_id, home_id) values (${copy.id}, ${h.home_id}) returning id`;
            for (const l of h.lines) {
              await sp`insert into appointment_lines (appointment_home_id, service_id, kind, name, qty, price_cents, duration_min, discount_id)
                       values (${ah.id}, ${l.service_id}, ${l.kind}, ${l.name}, ${l.qty}, ${l.price_cents}, ${l.duration_min}, ${l.discount_id})`;
            }
          }
        });
        created++;
      } catch (e) {
        if (!isExclusionViolation(e)) throw e;
        skipped.push({ date: r.date, reason: "Another visit" });
      }
    }
  });
  return { created, skipped };
}
