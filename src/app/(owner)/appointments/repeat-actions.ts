"use server";
import { revalidatePath } from "next/cache";
import { requireStaff, type StaffContext } from "@/lib/auth";
import { isExclusionViolation, sql } from "@/lib/db";
import { hm, isYmd, ymd, zonedToUtc } from "@/lib/format";
import { MAX_VISITS, repeatDates, type RepeatRule } from "@/lib/repeat";

// Repeating a visit: books copies of it (same time, pets and services) on every date of the
// rule. Changing the rule replaces the later copies that are still just booked; visits the
// client confirmed, checked in or paid are left alone. A date that is taken is skipped and
// reported, so the owner can book that one at another time.

export type RepeatState = {
  error?: string;
  done?: { created: number; skipped: { date: string; reason: string }[]; stopped?: boolean };
} | undefined;

const LIVE = ["requested", "unconfirmed", "confirmed", "en_route", "in_progress", "completed"];

function readRule(form: FormData): RepeatRule | string {
  const freq = String(form.get("freq"));
  const every = Number(form.get("every"));
  const ends = String(form.get("ends"));
  const count = Number(form.get("count"));
  const until = String(form.get("until") ?? "");
  if (freq !== "day" && freq !== "week" && freq !== "month") return "Pick day, week or month.";
  if (!Number.isInteger(every) || every < 1 || every > 52) return "Repeat every 1 to 52.";
  if (ends === "count") {
    if (!Number.isInteger(count) || count < 2 || count > MAX_VISITS) return `Pick 2 to ${MAX_VISITS} times.`;
    return { freq, every, count, until: null };
  }
  if (!isYmd(until)) return "Pick the last day.";
  return { freq, every, count: null, until };
}

/** Later copies in this visit's series that can still be replaced: not confirmed yet, not paid. */
async function replaceable(staff: StaffContext, a: { id: string; series_id: string | null; start_at: Date }) {
  if (!a.series_id) return [] as string[];
  const rows = await sql<{ id: string }[]>`
    select x.id from appointments x
    where x.business_id = ${staff.businessId} and x.series_id = ${a.series_id} and x.start_at > ${a.start_at}
      and x.status = 'unconfirmed' -- a visit the client already confirmed stays
      and not exists (select 1 from invoices i where i.appointment_id = x.id)`;
  return rows.map((r) => r.id);
}

export async function saveRepeatAction(appointmentId: string, _: RepeatState, form: FormData): Promise<RepeatState> {
  const staff = await requireStaff();
  const rule = readRule(form);
  if (typeof rule === "string") return { error: rule };
  const tz = staff.timezone;

  const [a] = await sql<{ id: string; client_id: string; staff_id: string; start_at: Date; end_at: Date; status: string; series_id: string | null;
                         address_line: string | null; zip: string | null; lat: number | null; lng: number | null; notes: string | null }[]>`
    select id, client_id, staff_id, start_at, end_at, status, series_id, address_line, zip, lat, lng, notes from appointments
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

  const pets = await sql<{ id: string; pet_id: string; services: { service_id: string | null; name: string; price_cents: number; duration_min: number }[] }[]>`
    select ap.id, ap.pet_id,
      coalesce((select json_agg(json_build_object('service_id', s.service_id, 'name', s.name, 'price_cents', s.price_cents,
                                                  'duration_min', s.duration_min) order by s.created_at)
                from appointment_services s where s.appointment_pet_id = ap.id), '[]'::json) as services
    from appointment_pets ap where ap.appointment_id = ${a.id}`;

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
                                      address_line, zip, lat, lng, notes)
            values (${staff.businessId}, ${a.client_id}, ${a.staff_id}, ${series.id}, ${r.s}, ${r.e}, 'unconfirmed', 'manual',
                    ${a.address_line}, ${a.zip}, ${a.lat}, ${a.lng}, ${a.notes})
            returning id`;
          for (const p of pets) {
            const [ap] = await sp`insert into appointment_pets (appointment_id, pet_id) values (${copy.id}, ${p.pet_id}) returning id`;
            for (const s of p.services) {
              await sp`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min)
                       values (${ap.id}, ${s.service_id}, ${s.name}, ${s.price_cents}, ${s.duration_min})`;
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
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath(`/appointments/${a.id}`);
  return { done: { created, skipped } };
}

/** Stops repeating: removes the later copies that are still just booked. */
export async function stopRepeatAction(appointmentId: string): Promise<RepeatState> {
  const staff = await requireStaff();
  const [a] = await sql<{ id: string; series_id: string | null; start_at: Date }[]>`
    select id, series_id, start_at from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!a?.series_id) return { error: "This visit doesn't repeat." };
  const old = await replaceable(staff, a);
  await sql.begin(async (tx) => {
    if (old.length) await tx`delete from appointments where id = any(${old}::uuid[])`;
    await tx`update appointments set series_id = null, updated_at = now() where id = ${a.id}`;
  });
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath(`/appointments/${a.id}`);
  return { done: { created: 0, skipped: [], stopped: true } };
}
