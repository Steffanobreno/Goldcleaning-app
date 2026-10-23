"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { notifyAppointment, notifyOwner } from "@/lib/messaging";
import { activeAgreement, currentSignature, recordSignature } from "@/lib/agreement";
import { dayLabel, money, timeLabel } from "@/lib/format";

// The client's own link. The token in the URL is the only key, so these actions only
// ever touch the one appointment it belongs to.

export async function confirmByTokenAction(token: string, form: FormData) {
  const [appt] = await sql`select id, business_id, client_id from appointments
                           where public_token = ${token} and status = 'unconfirmed' and start_at > now()`;
  if (!appt) return revalidatePath(`/a/${token}`);
  // Sign the service agreement first when it has not been signed in the last year.
  const agreement = await activeAgreement(appt.business_id);
  if (agreement && !(await currentSignature(agreement, appt.client_id))) {
    const name = String(form.get("signature") ?? "").trim();
    if (form.get("agree") !== "on" || name.length < 3) redirect(`/a/${token}?needSign=1`);
    await recordSignature(sql, agreement, appt.client_id, name);
  }
  const [done] = await sql`
    update appointments a set status = 'confirmed', confirmed_at = now()
    from clients c, businesses b
    where a.id = ${appt.id} and a.status = 'unconfirmed' and c.id = a.client_id and b.id = a.business_id
    returning a.start_at, b.timezone, trim(c.first_name || ' ' || c.last_name) as client`;
  await notifyAppointment(appt.id, "confirmed");
  if (done) {
    await notifyOwner(appt.business_id, `Confirmed: ${done.client}, ${dayLabel(done.start_at, done.timezone)}`,
      `${done.client} confirmed ${dayLabel(done.start_at, done.timezone)} ${timeLabel(done.start_at, done.timezone)}.`,
      `/appointments/${appt.id}`);
  }
  revalidatePath(`/a/${token}`);
}

export async function cancelByTokenAction(token: string) {
  // Clients may cancel any time. Inside the free window (48 h by default) a fee of half the
  // service price applies; it is noted on the visit and in the owner's email, not charged here.
  const [a] = await sql`
    update appointments a set status = 'cancelled', cancelled_at = now(),
      notes = case when a.start_at < now() + make_interval(hours => b.cancellation_hours)
                   then concat_ws(E'\n', a.notes, 'Late cancellation by the client: 50% fee applies.') else a.notes end
    from businesses b
    where b.id = a.business_id and a.public_token = ${token}
      and a.status in ('requested', 'unconfirmed', 'confirmed') and a.start_at > now()
    returning a.id, a.business_id, a.start_at, b.timezone,
      (a.start_at < now() + make_interval(hours => b.cancellation_hours)) as late,
      coalesce((select sum(s.price_cents) from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id
                where ap.appointment_id = a.id), 0)::int as total_cents,
      (select first_name || ' ' || last_name from clients where id = a.client_id) as client`;
  if (a) {
    await notifyAppointment(a.id, "cancelled");
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const when = `${dayLabel(a.start_at, a.timezone)} ${timeLabel(a.start_at, a.timezone)}`;
    const fee = a.late ? ` Late cancellation: 50% fee = ${money(Math.round(a.total_cents / 2))}.` : "";
    await notifyOwner(
      a.business_id,
      `Cancelled${a.late ? " (late)" : ""}: ${a.client}, ${dayLabel(a.start_at, a.timezone)}`,
      `${a.client} cancelled ${when} from their link.${fee}\n${appUrl}/appointments/${a.id}`,
      `/appointments/${a.id}`,
    );
  }
  revalidatePath(`/a/${token}`);
}

/** The client asks for a different time; the owner gets an email and a notification and moves it. */
export async function requestRescheduleByTokenAction(token: string, form: FormData) {
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  const [a] = await sql`
    update appointments a set reschedule_requested_at = now(), reschedule_note = ${note || null}
    from businesses b, clients c
    where b.id = a.business_id and c.id = a.client_id and a.public_token = ${token}
      and a.status in ('requested', 'unconfirmed', 'confirmed') and a.start_at > now()
    returning a.id, a.business_id, a.start_at, b.timezone, trim(c.first_name || ' ' || c.last_name) as client, c.phone`;
  if (a) {
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const when = `${dayLabel(a.start_at, a.timezone)} ${timeLabel(a.start_at, a.timezone)}`;
    await notifyOwner(
      a.business_id,
      `Reschedule request: ${a.client}`,
      `${a.client} wants to change ${when}.${note ? ` "${note}"` : ""}\nPhone: ${a.phone}\n${appUrl}/appointments/${a.id}`,
      `/appointments/${a.id}`,
    );
  }
  revalidatePath(`/a/${token}`);
}
