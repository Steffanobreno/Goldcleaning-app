"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, type StaffContext } from "@/lib/auth";
import { isExclusionViolation, sql } from "@/lib/db";
import { hm, isYmd, timeLabel, weekdayOf, ymd, zonedToUtc } from "@/lib/format";
import { tooFarFromDay, workingHoursFor } from "@/lib/data/appointments";
import { recalcInvoice } from "@/lib/data/invoices";
import { notifyAppointment } from "@/lib/messaging";
import { NEXT_STATUS } from "@/lib/appointment-status";
import { asGroomer, ownGroomer } from "@/lib/data/staff";

export type FormState = { error?: string; warning?: string } | undefined;

type PetPick = { petId: string; serviceIds: string[] };

/** Reads "pet:<id>" checkboxes and "svc:<petId>" multi-values from the booking form. */
function readPicks(form: FormData): PetPick[] {
  const picks: PetPick[] = [];
  for (const [key, value] of form.entries()) {
    if (key === "pet" && typeof value === "string") {
      const serviceIds = form.getAll(`svc:${value}`).map(String).filter(Boolean);
      picks.push({ petId: value, serviceIds });
    }
  }
  return picks;
}

async function outsideHours(staff: StaffContext, date: string, start: string, end: Date) {
  const hours = await workingHoursFor(staff, weekdayOf(date));
  if (!hours) return "That day is marked as a day off.";
  const endLocal = hm(end, staff.timezone);
  const endsNextDay = ymd(end, staff.timezone) !== date;
  if (start < hours.start_time.slice(0, 5) || endsNextDay || endLocal > hours.end_time.slice(0, 5))
    return `That time is outside working hours (${hours.start_time.slice(0, 5)}–${hours.end_time.slice(0, 5)}).`;
  return null;
}

// The owner may overlap visits on purpose (a dog finishing early), so this only warns.
async function overlapWarning(staff: StaffContext, start: Date, end: Date, excludeId?: string) {
  const [other] = await sql`
    select c.first_name, a.start_at from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId} and a.staff_id = ${staff.staffId}
      and a.status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed')
      and a.start_at < ${end} and a.end_at > ${start}
      and (${excludeId ?? null}::uuid is null or a.id <> ${excludeId ?? null})
    order by a.start_at limit 1`;
  if (other) return `This overlaps ${other.first_name}'s visit at ${timeLabel(other.start_at, staff.timezone)}.`;
  const [block] = await sql`
    select reason, start_at from time_off where staff_id = ${staff.staffId} and start_at < ${end} and end_at > ${start}
    order by start_at limit 1`;
  return block ? `This overlaps blocked time${block.reason ? ` (${block.reason})` : ""} at ${timeLabel(block.start_at, staff.timezone)}.` : null;
}

async function distanceWarning(staff: StaffContext, date: string, zip: string | null, excludeId?: string) {
  const far = await tooFarFromDay(staff, date, zip, excludeId);
  return far
    ? `This address is about ${Math.round(far.miles)} miles from ${far.client}'s stop that day (your limit is ${far.limit}).`
    : null;
}

export async function createAppointmentAction(clientId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireStaff();
  // The groomer who does the visit (their hours, blocks and route); the owner by default.
  const staff = asGroomer(me, (await ownGroomer(me, form.get("staff_id"))) ?? me.staffId);
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  const notes = String(form.get("notes") ?? "").trim() || null;
  const override = form.get("override") === "on";
  if (!isYmd(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and a start time." };

  const picks = readPicks(form);
  if (picks.length === 0) return { error: "Choose at least one pet." };
  if (picks.some((p) => p.serviceIds.length === 0)) return { error: "Choose a service for each pet." };

  const [client] = await sql`
    select id, address_line, city, state, zip, lat, lng from clients
    where id = ${clientId} and business_id = ${staff.businessId}`;
  if (!client) return { error: "Client not found." };

  const petIds = picks.map((p) => p.petId);
  const ownPets = await sql`select id from pets where client_id = ${clientId} and id = any(${petIds})`;
  if (ownPets.length !== new Set(petIds).size) return { error: "One of the pets does not belong to this client." };

  const serviceIds = [...new Set(picks.flatMap((p) => p.serviceIds))];
  const services = await sql<{ id: string; name: string; price_cents: number; duration_min: number }[]>`
    select id, name, price_cents, duration_min from services
    where business_id = ${staff.businessId} and active and id = any(${serviceIds})`;
  const byId = new Map(services.map((s) => [s.id, s]));
  if (serviceIds.some((id) => !byId.has(id))) return { error: "One of the services is no longer available." };

  // Pets are groomed one after the other, so the visit lasts the sum of all services.
  // The groomer may adjust the estimate on the form ("duration"); otherwise it's the services' total.
  const servicesMin = picks.flatMap((p) => p.serviceIds).reduce((sum, id) => sum + byId.get(id)!.duration_min, 0);
  const typed = Number(form.get("duration"));
  const totalMin = Number.isInteger(typed) && typed >= 15 && typed <= 720 ? typed : servicesMin;
  const startAt = zonedToUtc(date, time, staff.timezone);
  const endAt = new Date(startAt.getTime() + Math.max(totalMin, 15) * 60_000);

  if (!override) {
    const warning =
      (await outsideHours(staff, date, time, endAt)) ??
      (await overlapWarning(staff, startAt, endAt)) ??
      (await distanceWarning(staff, date, client.zip));
    if (warning) return { warning };
  }

  const address = [client.address_line, client.city, client.state].filter(Boolean).join(", ") || null;
  let id: string;
  try {
    id = await sql.begin(async (tx) => {
      const [appt] = await tx`
        insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, source,
                                  address_line, zip, lat, lng, notes)
        values (${staff.businessId}, ${clientId}, ${staff.staffId}, ${startAt}, ${endAt}, 'unconfirmed', 'manual',
                ${address}, ${client.zip}, ${client.lat}, ${client.lng}, ${notes})
        returning id`;
      // An adjusted estimate goes on the first service, so the visit's services still add up to its length.
      let delta = totalMin - servicesMin;
      for (const pick of picks) {
        const [ap] = await tx`insert into appointment_pets (appointment_id, pet_id) values (${appt.id}, ${pick.petId}) returning id`;
        for (const sid of pick.serviceIds) {
          const s = byId.get(sid)!;
          const minutes = Math.max(s.duration_min + delta, 0);
          delta -= minutes - s.duration_min;
          await tx`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min)
                   values (${ap.id}, ${s.id}, ${s.name}, ${s.price_cents}, ${minutes})`;
        }
      }
      return appt.id as string;
    });
  } catch (e) {
    if (isExclusionViolation(e)) return { error: "You already have an appointment at that time. Pick another time." };
    throw e;
  }
  if (form.get("notify") === "on") await notifyAppointment(id, "booked");
  revalidatePath("/today");
  revalidatePath("/calendar");
  redirect(`/appointments/${id}?booked=1`);
}


export async function setStatusAction(appointmentId: string, status: string) {
  const staff = await requireStaff();
  const [appt] = await sql`select status from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!appt || !NEXT_STATUS[appt.status]?.includes(status)) return;
  try {
    await sql`
      update appointments set status = ${status},
        confirmed_at = case when ${status} = 'confirmed' then now() else confirmed_at end,
        cancelled_at = case when ${status} in ('cancelled', 'no_show') then now() else null end,
        checked_in_at = case when ${status} = 'in_progress' then coalesce(checked_in_at, now()) else checked_in_at end,
        checked_out_at = case when ${status} = 'completed' then coalesce(checked_out_at, now())
                              when ${status} = 'in_progress' then null else checked_out_at end
      where id = ${appointmentId} and business_id = ${staff.businessId}`;
  } catch (e) {
    // Re-opening a cancelled visit can collide with a booking made in its place.
    if (isExclusionViolation(e)) redirect(`/appointments/${appointmentId}?conflict=1`);
    throw e;
  }
  // Tell the client when it affects them. An accepted online request gets the "booked"
  // message with the link to confirm; the reminder follows as for any visit.
  if (status === "cancelled") await notifyAppointment(appointmentId, "cancelled");
  if (status === "declined") await notifyAppointment(appointmentId, "request_declined");
  if (appt.status === "requested" && status === "unconfirmed") await notifyAppointment(appointmentId, "booked");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/requests");
  if (status === "completed") {
    await openInvoice(staff, appointmentId);
    redirect(`/appointments/${appointmentId}/checkout`);
  }
}

export async function rescheduleAction(appointmentId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireStaff();
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  if (!isYmd(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and a start time." };
  const [appt] = await sql`select start_at, end_at, zip, staff_id, status from appointments where id = ${appointmentId} and business_id = ${me.businessId}`;
  if (!appt) return { error: "Appointment not found." };
  if (!["requested", "unconfirmed", "confirmed"].includes(appt.status)) {
    return { error: "This visit already started or is closed. Book a new one instead." };
  }
  const staff = asGroomer(me, appt.staff_id);
  const startAt = zonedToUtc(date, time, staff.timezone);
  const endAt = new Date(startAt.getTime() + (appt.end_at.getTime() - appt.start_at.getTime()));
  if (form.get("override") !== "on") {
    const warning =
      (await outsideHours(staff, date, time, endAt)) ??
      (await overlapWarning(staff, startAt, endAt, appointmentId)) ??
      (await distanceWarning(staff, date, appt.zip, appointmentId));
    if (warning) return { warning };
  }
  try {
    await sql`update appointments set start_at = ${startAt}, end_at = ${endAt}, status = 'unconfirmed', confirmed_at = null,
                reschedule_requested_at = null, reschedule_note = null
              where id = ${appointmentId} and business_id = ${staff.businessId}`;
  } catch (e) {
    if (isExclusionViolation(e)) return { error: "You already have an appointment at that time. Pick another time." };
    throw e;
  }
  if (form.get("notify") === "on") await notifyAppointment(appointmentId, "booked");
  revalidatePath("/today");
  revalidatePath("/calendar");
  redirect(`/appointments/${appointmentId}`);
}

export async function updateNotesAction(appointmentId: string, form: FormData) {
  const staff = await requireStaff();
  const notes = String(form.get("notes") ?? "").trim() || null;
  await sql`update appointments set notes = ${notes} where id = ${appointmentId} and business_id = ${staff.businessId}`;
  revalidatePath(`/appointments/${appointmentId}`);
}

// ---------------------------------------------------------------- checkout

async function openInvoice(staff: StaffContext, appointmentId: string) {
  return sql.begin(async (tx) => {
    const [existing] = await tx`select id from invoices where appointment_id = ${appointmentId} and business_id = ${staff.businessId}`;
    if (existing) return existing.id as string;
    const [appt] = await tx`select client_id from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
    if (!appt) throw new Error("Appointment not found");
    const [inv] = await tx`insert into invoices (business_id, appointment_id, client_id)
                           values (${staff.businessId}, ${appointmentId}, ${appt.client_id}) returning id`;
    await tx`
      insert into invoice_items (invoice_id, kind, description, amount_cents)
      select ${inv.id}, case when sv.kind = 'addon' then 'addon' else 'service' end, p.name || ': ' || s.name, s.price_cents
      from appointment_pets ap
      join pets p on p.id = ap.pet_id
      join appointment_services s on s.appointment_pet_id = ap.id
      join services sv on sv.id = s.service_id
      where ap.appointment_id = ${appointmentId}
      order by p.name, s.created_at`;
    await recalcInvoice(tx, inv.id);
    return inv.id as string;
  });
}

export async function startCheckoutAction(appointmentId: string) {
  const staff = await requireStaff();
  await openInvoice(staff, appointmentId);
  redirect(`/appointments/${appointmentId}/checkout`);
}

async function editableInvoice(staff: StaffContext, appointmentId: string) {
  const [inv] = await sql`select id, status from invoices where appointment_id = ${appointmentId} and business_id = ${staff.businessId}`;
  return inv && inv.status === "open" ? (inv.id as string) : null;
}

/**
 * Adds a discount, a service charge or a tax to an open bill. The amount is in dollars, or a
 * percent of the services when it ends with "%" (worked out now and saved as dollars).
 */
export async function addInvoiceItemAction(appointmentId: string, form: FormData) {
  const staff = await requireStaff();
  const invoiceId = await editableInvoice(staff, appointmentId);
  if (!invoiceId) return;
  const kind = ["discount", "fee", "tax"].includes(String(form.get("kind"))) ? String(form.get("kind")) : "fee";
  const raw = String(form.get("amount") ?? "").replace(/[$,\s]/g, "");
  const percent = raw.endsWith("%") || form.get("unit") === "percent";
  const value = Number(raw.replace("%", ""));
  if (!Number.isFinite(value) || value <= 0) return;
  let cents = Math.round(value * 100);
  let label = "";
  if (percent) {
    if (value > 100) return;
    const [{ services }] = await sql`
      select coalesce(sum(amount_cents), 0)::int as services from invoice_items
      where invoice_id = ${invoiceId} and kind in ('service', 'addon', 'product')`;
    cents = Math.round((services * value) / 100);
    label = ` (${value}%)`;
  }
  if (cents <= 0) return;
  const fallback = kind === "discount" ? "Discount" : kind === "tax" ? "Tax" : "Service charge";
  const description = (String(form.get("description") ?? "").trim() || fallback) + label;
  await sql.begin(async (tx) => {
    await tx`insert into invoice_items (invoice_id, kind, description, amount_cents)
             values (${invoiceId}, ${kind}, ${description}, ${kind === "discount" ? -cents : cents})`;
    await recalcInvoice(tx, invoiceId);
  });
  revalidatePath(`/appointments/${appointmentId}/checkout`);
}

/** Corrects the check-in and check-out times (local date and time from the form). */
export async function saveVisitTimesAction(appointmentId: string, form: FormData) {
  const staff = await requireStaff();
  const parse = (k: string) => {
    const v = String(form.get(k) ?? "");
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? zonedToUtc(v.slice(0, 10), v.slice(11, 16), staff.timezone) : null;
  };
  const inAt = parse("checked_in_at");
  const outAt = parse("checked_out_at");
  if (inAt && outAt && outAt < inAt) return;
  await sql`update appointments set checked_in_at = ${inAt}, checked_out_at = ${outAt}
            where id = ${appointmentId} and business_id = ${staff.businessId}`;
  revalidatePath(`/appointments/${appointmentId}/checkout`);
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function removeInvoiceItemAction(appointmentId: string, itemId: string) {
  const staff = await requireStaff();
  const invoiceId = await editableInvoice(staff, appointmentId);
  if (!invoiceId) return;
  await sql.begin(async (tx) => {
    await tx`delete from invoice_items where id = ${itemId} and invoice_id = ${invoiceId}`;
    await recalcInvoice(tx, invoiceId);
  });
  revalidatePath(`/appointments/${appointmentId}/checkout`);
}

export async function recordPaymentAction(appointmentId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const invoiceId = await editableInvoice(staff, appointmentId);
  if (!invoiceId) return { error: "This checkout is already closed." };
  const method = String(form.get("method") ?? "");
  if (!["cash", "zelle", "venmo", "check", "bitcoin", "other"].includes(method)) return { error: "Choose how the client paid." };
  const toCents = (v: FormDataEntryValue | null) => {
    const t = String(v ?? "").replace(/[$,\s]/g, "");
    return t === "" ? 0 : Math.round(Number(t) * 100);
  };
  const amount = toCents(form.get("amount"));
  const tip = toCents(form.get("tip"));
  if (!Number.isFinite(amount) || !Number.isFinite(tip) || amount < 0 || tip < 0) return { error: "Check the amounts." };
  if (amount === 0 && tip === 0) return { error: "Enter the amount received." };
  const reference = String(form.get("reference") ?? "").trim().slice(0, 120) || null;
  const paidBy = String(form.get("paid_by") ?? "").trim().slice(0, 120) || null;
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;

  await sql.begin(async (tx) => {
    await tx`insert into payments (invoice_id, method, amount_cents, tip_cents, reference, paid_by, note, staff_id)
             values (${invoiceId}, ${method}, ${amount}, ${tip}, ${reference}, ${paidBy}, ${note}, ${staff.staffId})`;
    await recalcInvoice(tx, invoiceId);
    // Close the invoice once the bill is covered.
    await tx`update invoices set status = 'closed', closed_at = now()
             where id = ${invoiceId} and paid_cents >= total_cents`;
    await tx`update appointments set status = 'completed', checked_out_at = coalesce(checked_out_at, now()),
               checked_in_at = coalesce(checked_in_at, start_at)
             where id = ${appointmentId} and business_id = ${staff.businessId} and status <> 'completed'`;
  });
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath(`/appointments/${appointmentId}/checkout`);
  revalidatePath("/today");
  return undefined;
}

export async function reopenInvoiceAction(appointmentId: string) {
  const staff = await requireStaff();
  await sql`update invoices set status = 'open', closed_at = null
            where appointment_id = ${appointmentId} and business_id = ${staff.businessId}`;
  revalidatePath(`/appointments/${appointmentId}/checkout`);
}

// ---------------------------------------------------------------- edit services

export type ServiceLine = { id?: string; appointmentPetId: string; serviceId: string; priceCents: number; minutes: number };

/**
 * Replaces the services of a visit (after the client booked online, a dog may take less or
 * more time, or need an extra). The visit's end moves with the total time. Not allowed once
 * checkout started: prices are then changed on the bill.
 */
export async function saveServicesAction(appointmentId: string, lines: ServiceLine[]): Promise<{ error?: string; warning?: string } | undefined> {
  const staff = await requireStaff();
  const [appt] = await sql`select id, start_at, status, staff_id from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!appt) return { error: "Appointment not found." };
  const [inv] = await sql`select id from invoices where appointment_id = ${appointmentId}`;
  if (inv) return { error: "Checkout already started. Change prices on the bill instead." };
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 40) return { error: "Keep at least one service." };
  for (const l of lines) {
    if (!Number.isInteger(l.priceCents) || l.priceCents < 0 || l.priceCents > 1_000_000) return { error: "Check the prices." };
    if (!Number.isInteger(l.minutes) || l.minutes < 0 || l.minutes > 720) return { error: "Each service takes 0 to 12 hours." };
  }
  const pets = await sql`select id from appointment_pets where appointment_id = ${appointmentId}`;
  const petIds = new Set(pets.map((p) => p.id as string));
  if (lines.some((l) => !petIds.has(l.appointmentPetId))) return { error: "Please reload the page and try again." };
  for (const pid of petIds) {
    if (!lines.some((l) => l.appointmentPetId === pid)) return { error: "Each pet needs at least one service." };
  }
  const existing = await sql`
    select s.id from appointment_services s join appointment_pets ap on ap.id = s.appointment_pet_id
    where ap.appointment_id = ${appointmentId}`;
  const existingIds = new Set(existing.map((e) => e.id as string));
  if (lines.some((l) => l.id && !existingIds.has(l.id))) return { error: "Please reload the page and try again." };
  const serviceIds = [...new Set(lines.map((l) => l.serviceId))];
  const services = await sql<{ id: string; name: string }[]>`
    select id, name from services where business_id = ${staff.businessId} and id = any(${serviceIds})`;
  const names = new Map(services.map((s) => [s.id, s.name]));
  if (serviceIds.some((id) => !names.has(id))) return { error: "One of the services no longer exists." };

  const totalMin = lines.reduce((s, l) => s + l.minutes, 0);
  const endAt = new Date(appt.start_at.getTime() + Math.max(totalMin, 15) * 60_000);
  try {
    await sql.begin(async (tx) => {
      const keep = lines.map((l) => l.id).filter((x): x is string => !!x);
      await tx`delete from appointment_services s using appointment_pets ap
               where ap.id = s.appointment_pet_id and ap.appointment_id = ${appointmentId}
                 and not (s.id = any(${keep}::uuid[]))`;
      for (const l of lines) {
        if (l.id) {
          await tx`update appointment_services set price_cents = ${l.priceCents}, duration_min = ${l.minutes}
                   where id = ${l.id}`;
        } else {
          await tx`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min)
                   values (${l.appointmentPetId}, ${l.serviceId}, ${names.get(l.serviceId)!}, ${l.priceCents}, ${l.minutes})`;
        }
      }
      await tx`update appointments set end_at = ${endAt} where id = ${appointmentId}`;
    });
  } catch (e) {
    if (isExclusionViolation(e)) return { error: "With that length it runs into another online booking. Shorten it or move one visit." };
    throw e;
  }
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/today");
  revalidatePath("/calendar");
  const warning = await overlapWarning(asGroomer(staff, appt.staff_id), appt.start_at, endAt, appointmentId);
  return warning ? { warning: `Saved. Heads up: ${warning.charAt(0).toLowerCase()}${warning.slice(1)}` } : undefined;
}

/** Gives the visit to another groomer (same time), when they're free then. */
export async function assignGroomerAction(appointmentId: string, form: FormData) {
  const staff = await requireStaff();
  const to = await ownGroomer(staff, form.get("staff_id"));
  if (!to) return;
  const [busy] = await sql`
    select 1 from appointments a join appointments x on x.id = ${appointmentId}
    where a.staff_id = ${to} and a.id <> x.id and a.business_id = ${staff.businessId}
      and a.status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed')
      and a.start_at < x.end_at and a.end_at > x.start_at limit 1`;
  if (busy) redirect(`/appointments/${appointmentId}?groomerBusy=1`);
  try {
    await sql`update appointments set staff_id = ${to}, updated_at = now() where id = ${appointmentId} and business_id = ${staff.businessId}`;
  } catch (e) {
    if (isExclusionViolation(e)) redirect(`/appointments/${appointmentId}?groomerBusy=1`);
    throw e;
  }
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath(`/appointments/${appointmentId}`);
}

/** Removes a payment typed by mistake; the bill opens again if it's no longer covered. */
export async function deletePaymentAction(appointmentId: string, paymentId: string) {
  const staff = await requireStaff();
  await sql.begin(async (tx) => {
    const [p] = await tx`
      select p.invoice_id from payments p join invoices i on i.id = p.invoice_id
      where p.id = ${paymentId} and i.business_id = ${staff.businessId} and i.appointment_id = ${appointmentId}`;
    if (!p) return;
    await tx`delete from payments where id = ${paymentId}`;
    await recalcInvoice(tx, p.invoice_id);
    await tx`update invoices set status = 'open', closed_at = null
             where id = ${p.invoice_id} and status = 'closed' and paid_cents < total_cents`;
  });
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath(`/appointments/${appointmentId}/checkout`);
  revalidatePath("/reports");
}
