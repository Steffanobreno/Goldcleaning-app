"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, type StaffContext } from "@/lib/auth";
import { isExclusionViolation, sql } from "@/lib/db";
import { addDaysYmd, hm, isYmd, timeLabel, todayYmd, weekdayOf, ymd, zonedToUtc } from "@/lib/format";
import { workingHoursFor } from "@/lib/data/appointments";
import { insertAppointment } from "@/lib/data/appointment-write";
import { loadCatalog } from "@/lib/data/catalog";
import { agreedQuote, FREQUENCIES, quote, type Frequency, type HomeSize, type PriceLine } from "@/lib/pricing";
import { recalcInvoice } from "@/lib/data/invoices";
import { notifyAppointment } from "@/lib/messaging";
import { NEXT_STATUS } from "@/lib/appointment-status";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { seriesForFrequency } from "@/lib/repeat";
import { bookSeries } from "@/lib/data/series";
import { asGroomer, ownGroomer } from "@/lib/data/staff";

export type FormState = { error?: string; warning?: string } | undefined;

/** Reads the "x:<extraId>" quantities from the booking form. */
function readExtras(form: FormData) {
  const extras: { serviceId: string; qty: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (key.startsWith("x:")) extras.push({ serviceId: key.slice(2), qty: Number(value) || 0 });
  }
  return extras;
}

/** Prices the form: from the price list, or at the agreed price for a quote-only service. */
async function priceForm(businessId: string, form: FormData, home: HomeSize, frequency: Frequency) {
  const catalog = await loadCatalog(businessId);
  const serviceId = String(form.get("service") ?? "");
  if (catalog.services.find((s) => s.id === serviceId)?.pricing === "quote") {
    const cents = Math.round(Number(String(form.get("agreed_price") ?? "").replace(/[$,\s]/g, "")) * 100);
    return agreedQuote(catalog, { serviceId, frequency, home }, cents);
  }
  return quote(catalog, { serviceId, frequency, home, extras: readExtras(form) });
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

// The owner may overlap visits on purpose (a small job before a big one), so this only warns.
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

export async function createAppointmentAction(clientId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  const notes = String(form.get("notes") ?? "").trim() || null;
  const override = form.get("override") === "on";
  if (!isYmd(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and a start time." };

  const homeId = String(form.get("home") ?? "");
  const [home] = await sql`
    select h.bedrooms, h.full_baths, h.half_baths from homes h join clients c on c.id = h.client_id
    where h.id = ${homeId} and h.client_id = ${clientId} and c.business_id = ${staff.businessId}`;
  if (!home) return { error: "Choose the home." };
  const frequency = String(form.get("frequency") ?? "one_time") as Frequency;
  if (!FREQUENCIES.includes(frequency)) return { error: "Choose how often." };

  const q = await priceForm(staff.businessId, form, { bedrooms: home.bedrooms, fullBaths: home.full_baths, halfBaths: home.half_baths }, frequency);
  if ("error" in q) return { error: q.error };
  const lines: (PriceLine | (Omit<PriceLine, "kind"> & { kind: "adjustment" }))[] = [...q.lines];
  const adjust = String(form.get("adjustment") ?? "").replace(/[$,\s]/g, "");
  if (adjust !== "") {
    const cents = Math.round(Number(adjust) * 100);
    if (!Number.isFinite(cents) || Math.abs(cents) > 1_000_000) return { error: "Check the price adjustment." };
    if (cents !== 0) lines.push({ kind: "adjustment", serviceId: null, label: cents < 0 ? "Discount" : "Adjustment", qty: 1, unitCents: cents, amountCents: cents });
  }

  // The owner may change the estimate on the form ("duration"); otherwise it comes from the home size.
  const typed = Number(form.get("duration"));
  const durationMin = Number.isInteger(typed) && typed >= 30 && typed <= 720 ? typed : q.durationMin;
  const startAt = zonedToUtc(date, time, staff.timezone);
  const endAt = new Date(startAt.getTime() + durationMin * 60_000);

  if (!override) {
    const warning = (await outsideHours(staff, date, time, endAt)) ?? (await overlapWarning(staff, startAt, endAt));
    if (warning) return { warning };
  }

  let id: string;
  try {
    id = await sql.begin((tx) =>
      insertAppointment(tx, {
        businessId: staff.businessId,
        clientId,
        staffId: staff.staffId,
        homeId,
        serviceId: q.service.id,
        frequency,
        startAt,
        durationMin,
        status: "unconfirmed",
        source: "manual",
        notes,
        lines: lines as PriceLine[],
      }),
    );
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
  const [appt] = await sql`select status, frequency from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!appt || !NEXT_STATUS[appt.status]?.includes(status)) return;
  const accepted = appt.status === "requested" && status === "confirmed";
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
  // Tell the client when it affects them. An accepted online request gets the confirmation
  // with the link to see or change it; the reminder follows as for any visit.
  if (status === "cancelled") await notifyAppointment(appointmentId, "cancelled");
  if (status === "declined") await notifyAppointment(appointmentId, "request_declined");
  if (accepted) await notifyAppointment(appointmentId, "request_accepted");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/requests");
  if (status === "completed") {
    await openInvoice(staff, appointmentId);
    redirect(`/appointments/${appointmentId}/checkout`);
  }
  // Accepting a recurring request books the next cleanings up to the booking window; the
  // visit's page then says how many, and which dates were taken.
  const repeat = accepted ? seriesForFrequency(appt.frequency) : null;
  if (repeat) {
    const [b] = await sql`select booking_days_ahead from businesses where id = ${staff.businessId}`;
    const until = addDaysYmd(todayYmd(staff.timezone), b.booking_days_ahead);
    const r = await bookSeries(staff, appointmentId, { freq: repeat.freq, every: repeat.interval, count: null, until }, "confirmed");
    const q = "error" in r ? "" : `&repeat=${r.created}${r.skipped.length ? `&taken=${r.skipped.map((x) => x.date).join(",")}` : ""}`;
    redirect(`/appointments/${appointmentId}?accepted=1${q}`);
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
      (await overlapWarning(staff, startAt, endAt, appointmentId));
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
      select ${inv.id},
             case l.kind when 'extra' then 'addon' when 'adjustment' then (case when l.price_cents < 0 then 'discount' else 'fee' end)
                         else 'service' end,
             l.name || case when l.qty > 1 then ' × ' || l.qty else '' end, l.price_cents
      from appointment_homes ah
      join appointment_lines l on l.appointment_home_id = ah.id
      where ah.appointment_id = ${appointmentId}
      order by l.created_at, l.id`;
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
  if (!PAYMENT_METHODS.some((m) => m.value === method)) return { error: "Choose how the client paid." };
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

// ---------------------------------------------------------------- edit the price

/**
 * Re-prices a booked visit (the client added an extra on the phone, or a discount): the lines
 * are worked out again from today's price list and replace the old ones; the visit's end moves
 * with its length. Not allowed once checkout started: prices are then changed on the bill.
 */
export async function saveLinesAction(appointmentId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const [appt] = await sql`
    select a.id, a.start_at, a.staff_id, ah.id as appointment_home_id, h.bedrooms, h.full_baths, h.half_baths
    from appointments a join appointment_homes ah on ah.appointment_id = a.id join homes h on h.id = ah.home_id
    where a.id = ${appointmentId} and a.business_id = ${staff.businessId}
    order by ah.created_at limit 1`;
  if (!appt) return { error: "Appointment not found." };
  const [inv] = await sql`select id from invoices where appointment_id = ${appointmentId}`;
  if (inv) return { error: "Checkout already started. Change prices on the bill instead." };
  const frequency = String(form.get("frequency") ?? "one_time") as Frequency;
  if (!FREQUENCIES.includes(frequency)) return { error: "Choose how often." };
  const q = await priceForm(staff.businessId, form, { bedrooms: appt.bedrooms, fullBaths: appt.full_baths, halfBaths: appt.half_baths }, frequency);
  if ("error" in q) return { error: q.error };
  const adjust = String(form.get("adjustment") ?? "").replace(/[$,\s]/g, "");
  const adjustCents = adjust === "" ? 0 : Math.round(Number(adjust) * 100);
  if (!Number.isFinite(adjustCents) || Math.abs(adjustCents) > 1_000_000) return { error: "Check the price adjustment." };
  const typed = Number(form.get("duration"));
  const durationMin = Number.isInteger(typed) && typed >= 30 && typed <= 720 ? typed : q.durationMin;
  const endAt = new Date(appt.start_at.getTime() + durationMin * 60_000);
  try {
    await sql.begin(async (tx) => {
      await tx`delete from appointment_lines where appointment_home_id = ${appt.appointment_home_id}`;
      for (const l of q.lines) {
        await tx`insert into appointment_lines (appointment_home_id, service_id, kind, name, qty, price_cents, duration_min)
                 values (${appt.appointment_home_id}, ${l.serviceId}, ${l.kind}, ${l.label}, ${l.qty}, ${l.amountCents},
                         ${l.kind === "service" ? durationMin : 0})`;
      }
      if (adjustCents !== 0) {
        await tx`insert into appointment_lines (appointment_home_id, service_id, kind, name, qty, price_cents, duration_min)
                 values (${appt.appointment_home_id}, null, 'adjustment', ${adjustCents < 0 ? "Discount" : "Adjustment"}, 1, ${adjustCents}, 0)`;
      }
      await tx`update appointments set end_at = ${endAt}, service_id = ${q.service.id}, frequency = ${frequency}
               where id = ${appointmentId}`;
    });
  } catch (e) {
    if (isExclusionViolation(e)) return { error: "With that length it runs into another online booking. Shorten it or move one visit." };
    throw e;
  }
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/today");
  revalidatePath("/calendar");
  const warning = await overlapWarning(asGroomer(staff, appt.staff_id), appt.start_at, endAt, appointmentId);
  if (warning && form.get("override") !== "on") return { warning: `Saved. Heads up: ${warning.charAt(0).toLowerCase()}${warning.slice(1)}` };
  redirect(`/appointments/${appointmentId}`);
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
