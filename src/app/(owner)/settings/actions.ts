"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { normalizePhone, parseMoney } from "@/lib/format";
import { sendEmail } from "@/lib/email";

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function saveServiceAction(serviceId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim();
  const kind = form.get("kind") === "extra" ? "extra" : "service";
  const category = kind === "extra" ? "Extras" : null;
  const per_unit = kind === "extra" && form.get("per_unit") === "on";
  const pricing = kind === "service" && form.get("pricing") === "quote" ? "quote" : "rate";
  const recurring = kind === "service" && form.get("recurring") === "on";
  const icon = kind === "extra" ? String(form.get("icon") ?? "").trim().slice(0, 30) || null : null;
  const price = kind === "extra" ? parseMoney(form.get("price")) : 0;
  const description = String(form.get("description") ?? "").trim() || null;
  const active = form.get("active") === "on";
  const online = form.get("online_bookable") === "on";
  if (!name) return { error: "Give it a name." };
  if (price === null) return { error: "Enter a price, like 45 or 45.00." };
  const v = { name, kind, category, per_unit, pricing, recurring, icon, price_cents: price, description, active, online_bookable: online };
  if (serviceId) {
    await sql`update services set ${sql(v)} where id = ${serviceId} and business_id = ${staff.businessId}`;
  } else {
    const [{ next }] = await sql`select coalesce(max(sort_order), 0) + 1 as next from services where business_id = ${staff.businessId}`;
    await sql`insert into services ${sql({ ...v, business_id: staff.businessId, duration_min: 0, sort_order: next })}`;
  }
  revalidatePath("/settings/services");
  redirect("/settings/services");
}

/**
 * Saves a cleaning's prices: one row per frequency (start, each extra bedroom, full bath and
 * half bath, in dollars). A row left empty is not offered. Booked visits keep their prices.
 */
export async function saveRatesAction(serviceId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const [svc] = await sql`select id, recurring from services where id = ${serviceId} and business_id = ${staff.businessId} and kind = 'service'`;
  if (!svc) return { error: "Service not found." };
  const freqs = svc.recurring ? ["one_time", "weekly", "biweekly", "every_4_weeks"] : ["one_time"];
  const rows: { frequency: string; start_cents: number; bedroom_cents: number; full_bath_cents: number; half_bath_cents: number }[] = [];
  for (const f of freqs) {
    const fields = ["start", "bedroom", "full_bath", "half_bath"].map((k) => String(form.get(`${f}:${k}`) ?? "").trim());
    if (fields.every((x) => x === "")) continue;
    const cents = fields.map((x) => parseMoney(x));
    if (cents.some((c) => c === null)) return { error: "Fill in every price of a row (0 is fine), or leave the whole row empty." };
    const [start, bedroom, full, half] = cents as number[];
    rows.push({ frequency: f, start_cents: start, bedroom_cents: bedroom, full_bath_cents: full, half_bath_cents: half });
  }
  if (rows.length === 0) return { error: "Set at least one row of prices." };
  await sql.begin(async (tx) => {
    await tx`delete from service_rates where service_id = ${serviceId} and not (frequency = any(${rows.map((r) => r.frequency)}))`;
    for (const r of rows) {
      await tx`
        insert into service_rates ${tx({ ...r, service_id: serviceId })}
        on conflict (service_id, frequency) do update set start_cents = excluded.start_cents, bedroom_cents = excluded.bedroom_cents,
          full_bath_cents = excluded.full_bath_cents, half_bath_cents = excluded.half_bath_cents`;
    }
  });
  revalidatePath("/settings/services");
  revalidatePath("/book");
  return { saved: true };
}

export async function moveServiceAction(serviceId: string, direction: "up" | "down") {
  const staff = await requireStaff();
  // Swap sort_order with the neighbor in the same kind and category.
  await sql.begin(async (tx) => {
    const [me] = await tx`select id, kind, category, sort_order from services
                          where id = ${serviceId} and business_id = ${staff.businessId}`;
    if (!me) return;
    const [other] = direction === "up"
      ? await tx`select id, sort_order from services where business_id = ${staff.businessId} and kind = ${me.kind}
                 and category is not distinct from ${me.category} and sort_order < ${me.sort_order}
                 order by sort_order desc limit 1`
      : await tx`select id, sort_order from services where business_id = ${staff.businessId} and kind = ${me.kind}
                 and category is not distinct from ${me.category} and sort_order > ${me.sort_order}
                 order by sort_order limit 1`;
    if (!other) return;
    await tx`update services set sort_order = ${other.sort_order} where id = ${me.id}`;
    await tx`update services set sort_order = ${me.sort_order} where id = ${other.id}`;
  });
  revalidatePath("/settings/services");
}

export async function saveHoursAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const rows: { weekday: number; start: string; end: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`open:${d}`) !== "on") continue;
    const start = String(form.get(`start:${d}`) ?? "");
    const end = String(form.get(`end:${d}`) ?? "");
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start)
      return { error: "Each open day needs a start time before its end time." };
    rows.push({ weekday: d, start, end });
  }
  await sql.begin(async (tx) => {
    await tx`delete from working_hours where staff_id = ${staff.staffId}`;
    for (const r of rows) {
      await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
               values (${staff.staffId}, ${r.weekday}, ${r.start}, ${r.end})`;
    }
  });
  revalidatePath("/settings/hours");
  revalidatePath("/calendar");
  return { saved: true };
}

export async function saveBusinessAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim();
  const rawPhone = String(form.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const slug = String(form.get("booking_slug") ?? "").trim().toLowerCase();
  const ownerName = String(form.get("owner_name") ?? "").trim();
  if (!name) return { error: "The business needs a name." };
  if (rawPhone && !phone) return { error: "Enter a 10-digit US phone number." };
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { error: "The booking link can use letters, numbers and dashes (3 to 40)." };
  try {
    await sql.begin(async (tx) => {
      await tx`update businesses set name = ${name}, phone = ${phone}, booking_slug = ${slug} where id = ${staff.businessId}`;
      if (ownerName) await tx`update staff set name = ${ownerName} where id = ${staff.staffId}`;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "That booking link is taken." };
    throw e;
  }
  revalidatePath("/settings");
  return { saved: true };
}

export async function saveBookingSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const num = (k: string) => Number(String(form.get(k) ?? "").trim());
  const base = num("base_duration_min");
  const bedrooms = num("large_home_bedrooms");
  const extra = num("large_home_extra_min");
  const notice = num("min_notice_hours");
  const ahead = num("booking_days_ahead");
  const cancelHours = num("cancellation_hours");
  const cities = [...new Set(String(form.get("service_cities") ?? "").split(/[\n,]/).map((c) => c.trim()).filter(Boolean))];
  if (![base, bedrooms, extra, notice, ahead, cancelHours].every(Number.isInteger)) return { error: "Use whole numbers only." };
  if (base < 30 || base > 600) return { error: "Cleaning length: 30 to 600 minutes." };
  if (bedrooms < 0 || bedrooms > 7 || extra < 0 || extra > 480) return { error: "Larger homes: 0 to 7 bedrooms, 0 to 480 extra minutes." };
  if (notice < 0 || notice > 336) return { error: "Notice: 0 to 336 hours." };
  if (ahead < 1 || ahead > 180) return { error: "Clients can book 1 to 180 days ahead." };
  if (cancelHours < 0 || cancelHours > 168) return { error: "Cancellation window: 0 to 168 hours." };
  if (cities.length === 0) return { error: "List at least one city you serve." };
  await sql`
    update businesses set online_booking_enabled = ${form.get("online_booking_enabled") === "on"},
      base_duration_min = ${base}, large_home_bedrooms = ${bedrooms}, large_home_extra_min = ${extra},
      min_notice_hours = ${notice}, booking_days_ahead = ${ahead}, cancellation_hours = ${cancelHours},
      service_cities = ${cities}
    where id = ${staff.businessId}`;
  revalidatePath("/settings/booking");
  return { saved: true };
}

/** The online start times: a morning and an afternoon time (or none) for each weekday. */
export async function saveSlotsAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const rows: { weekday: number; start_time: string; label: string }[] = [];
  for (let d = 0; d < 7; d++) {
    for (const [part, label] of [["morning", "Morning"], ["afternoon", "Afternoon"]] as const) {
      const t = String(form.get(`${d}:${part}`) ?? "").trim();
      if (!t) continue;
      if (!/^\d{2}:\d{2}$/.test(t)) return { error: "Check the times (like 09:00)." };
      if ((part === "morning") !== t < "12:00") return { error: `${label} times are ${part === "morning" ? "before" : "from"} noon.` };
      rows.push({ weekday: d, start_time: t, label });
    }
  }
  if (rows.length === 0) return { error: "Keep at least one start time, or turn online booking off above." };
  await sql.begin(async (tx) => {
    await tx`delete from booking_slots where business_id = ${staff.businessId}`;
    await tx`insert into booking_slots ${tx(rows.map((r) => ({ ...r, business_id: staff.businessId })))}`;
  });
  revalidatePath("/settings/booking");
  return { saved: true };
}

export async function saveMessagingSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const text = (k: string) => String(form.get(k) ?? "").trim() || null;
  const email = text("email");
  const review = text("review_url");
  const website = text("website_url");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Check the email address." };
  for (const url of [review, website]) if (url && !/^https:\/\/\S+$/.test(url)) return { error: "Links must start with https://" };
  await sql`update businesses set email = ${email}, review_url = ${review}, website_url = ${website} where id = ${staff.businessId}`;
  revalidatePath("/settings/messages");
  return { saved: true };
}

export async function saveTemplateAction(templateId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const body = String(form.get("body") ?? "").trim();
  const subject = String(form.get("email_subject") ?? "").trim() || null;
  if (!body) return { error: "The message can't be empty." };
  const days = form.get("offset_days");
  const minutes = form.get("offset_minutes");
  const time = String(form.get("send_at_time") ?? "");
  await sql`
    update message_templates set body = ${body}, email_subject = ${subject}, enabled = ${form.get("enabled") === "on"},
      offset_days = coalesce(${days === null ? null : Number(days)}::int, offset_days),
      offset_minutes = coalesce(${minutes === null ? null : Number(minutes)}::int, offset_minutes),
      send_at_time = coalesce(${/^\d{2}:\d{2}$/.test(time) ? time : null}::time, send_at_time)
    where id = ${templateId} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/messages");
  return { saved: true };
}

export async function newDeviceKeyAction() {
  const staff = await requireStaff();
  await sql`update businesses set device_key = encode(gen_random_bytes(24), 'hex') where id = ${staff.businessId}`;
  revalidatePath("/settings/messages");
}

export async function saveAgreementAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!title || body.length < 20) return { error: "The agreement needs a title and its text." };
  const resign = form.get("resign") === "on";
  const required = form.get("required_online") === "on";
  const [current] = await sql`select id from agreements where business_id = ${staff.businessId} and active order by created_at desc limit 1`;
  if (current) {
    // A new version makes every client sign again on their next booking or confirm link.
    await sql`update agreements set title = ${title}, body = ${body}, required_online = ${required},
                version = version + ${resign ? 1 : 0} where id = ${current.id}`;
  } else {
    await sql`insert into agreements (business_id, title, body, required_online) values (${staff.businessId}, ${title}, ${body}, ${required})`;
  }
  revalidatePath("/settings/agreement");
  return { saved: true };
}

export async function setAutoMessagesAction(on: boolean) {
  const staff = await requireStaff();
  await sql`update businesses set auto_messages_enabled = ${on} where id = ${staff.businessId}`;
  revalidatePath("/settings/messages");
}

/** Sends a sample email to the owner's own address, to check the Gmail setup. */
export async function sendTestEmailAction(): Promise<FormState & { sentTo?: string }> {
  const staff = await requireStaff();
  const [b] = await sql`select name, email from businesses where id = ${staff.businessId}`;
  const to = b?.email || process.env.GMAIL_USER;
  if (!to) return { error: "Add your email above first." };
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  try {
    await sendEmail({
      to,
      subject: `Test email from ${b.name}`,
      text: `This is how your clients see emails from ${b.name}. When it's about an appointment, the button below opens their page to see, confirm or cancel it.\n\nYour booking page: ${appUrl}/book`,
      fromName: b.name,
    });
  } catch (e) {
    return { error: `Gmail refused it: ${(e as Error).message}. Check GMAIL_USER and GMAIL_APP_PASSWORD on Netlify.` };
  }
  return { saved: true, sentTo: to };
}


// ---------------------------------------------------------------- discounts

/** Creates or changes a discount: a percent or a dollar amount, with an optional coupon code. */
export async function saveDiscountAction(discountId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const kind = form.get("kind") === "amount" ? "amount" : "percent";
  const value = Number(String(form.get("value") ?? "").replace(/[$,%\s]/g, ""));
  const code = String(form.get("code") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const dateOrNull = (k: string) => {
    const v = String(form.get(k) ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const starts = dateOrNull("starts_on");
  const ends = dateOrNull("ends_on");
  const maxRaw = String(form.get("max_uses") ?? "").trim();
  const maxUses = maxRaw === "" ? null : Number(maxRaw);
  if (!name) return { error: "Give the discount a name." };
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter how much it takes off." };
  if (kind === "percent" && value > 100) return { error: "A percent can't be more than 100." };
  if (kind === "amount" && value > 10_000) return { error: "That amount looks too big." };
  if (code && !/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "A code is 3 to 30 letters, numbers, - or _ (no spaces)." };
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return { error: "How many times it can be used must be a whole number, or empty." };
  if (starts && ends && ends < starts) return { error: "The end date is before the start date." };
  const v = {
    name,
    code: code || null,
    kind,
    percent: kind === "percent" ? value : null,
    amount_cents: kind === "amount" ? Math.round(value * 100) : null,
    first_time_only: !!code && form.get("first_time_only") === "on",
    starts_on: starts,
    ends_on: ends,
    max_uses: maxUses,
    active: form.get("active") === "on",
  };
  try {
    if (discountId) {
      await sql`update discounts set ${sql(v)} where id = ${discountId} and business_id = ${staff.businessId}`;
    } else {
      await sql`insert into discounts ${sql({ ...v, business_id: staff.businessId })}`;
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Another discount already uses that code." };
    throw e;
  }
  revalidatePath("/settings/discounts");
  redirect("/settings/discounts");
}

/** Deletes a discount. Visits that used it keep the price they were booked at. */
export async function deleteDiscountAction(discountId: string) {
  const staff = await requireStaff();
  await sql`delete from discounts where id = ${discountId} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/discounts");
  redirect("/settings/discounts");
}
