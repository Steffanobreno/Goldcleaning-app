"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { normalizePhone, parseMoney, SIZES } from "@/lib/format";
import { sendEmail } from "@/lib/email";

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function saveServiceAction(serviceId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim();
  const kind = form.get("kind") === "addon" ? "addon" : "service";
  const category = String(form.get("category") ?? "").trim() || (kind === "addon" ? "Add-on" : null);
  const size = String(form.get("size_class") ?? "");
  const size_class = SIZES.some((s) => s.value === size) ? size : null;
  const duration = Number(form.get("duration_min"));
  const price = parseMoney(form.get("price"));
  const description = String(form.get("description") ?? "").trim() || null;
  const active = form.get("active") === "on";
  const online = form.get("online_bookable") === "on";
  if (!name) return { error: "Give the service a name." };
  if (!Number.isInteger(duration) || duration < 0 || duration > 600) return { error: "Duration must be 0 to 600 minutes." };
  if (price === null) return { error: "Enter a price, like 129 or 129.00." };

  if (serviceId) {
    await sql`
      update services set name = ${name}, kind = ${kind}, category = ${category}, size_class = ${size_class},
        duration_min = ${duration}, price_cents = ${price}, description = ${description},
        active = ${active}, online_bookable = ${online}
      where id = ${serviceId} and business_id = ${staff.businessId}`;
  } else {
    await sql`
      insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, description,
                            active, online_bookable, sort_order)
      values (${staff.businessId}, ${name}, ${kind}, ${category}, ${size_class}, ${duration}, ${price}, ${description},
              ${active}, ${online},
              (select coalesce(max(sort_order), 0) + 1 from services where business_id = ${staff.businessId}))`;
  }
  revalidatePath("/settings/services");
  redirect("/settings/services");
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
  const buffer = num("buffer_minutes");
  const miles = num("max_cluster_miles");
  const radius = num("service_radius_miles");
  const notice = num("min_notice_hours");
  const ahead = num("booking_days_ahead");
  const cancelHours = num("cancellation_hours");
  const slot = num("slot_minutes");
  const startZip = String(form.get("start_zip") ?? "").trim();
  if (![buffer, miles, radius, notice, ahead, cancelHours, slot].every(Number.isFinite)) return { error: "Use numbers only." };
  if (buffer < 0 || buffer > 180) return { error: "Driving time between visits: 0 to 180 minutes." };
  if (miles < 1 || miles > 200 || radius < 1 || radius > 300) return { error: "Distances must be between 1 and 200 miles." };
  if (notice < 0 || notice > 336) return { error: "Notice: 0 to 336 hours." };
  if (ahead < 1 || ahead > 180) return { error: "Clients can book 1 to 180 days ahead." };
  if (cancelHours < 0 || cancelHours > 168) return { error: "Cancellation window: 0 to 168 hours." };
  if (slot < 15 || slot > 240) return { error: "Start times: every 15 to 240 minutes." };
  if (startZip && !/^\d{5}$/.test(startZip)) return { error: "The van's ZIP code has 5 digits." };
  await sql`
    update businesses set online_booking_enabled = ${form.get("online_booking_enabled") === "on"},
      buffer_minutes = ${buffer}, max_cluster_miles = ${miles}, service_radius_miles = ${radius},
      min_notice_hours = ${notice}, booking_days_ahead = ${ahead}, cancellation_hours = ${cancelHours},
      slot_minutes = ${slot}, start_zip = ${startZip || null}
    where id = ${staff.businessId}`;
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

/**
 * Puts a test text in the iPhone outbox. Run the Shortcut (or wait for its next run) and
 * the text goes out from the owner's own number: proof the whole chain works.
 */
export async function queueTestTextAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const phone = normalizePhone(form.get("phone"));
  if (!phone) return { error: "Enter a 10-digit mobile number." };
  const [b] = await sql`select name from businesses where id = ${staff.businessId}`;
  await sql`
    insert into messages (business_id, direction, channel, to_phone, body, template_trigger, status)
    values (${staff.businessId}, 'out', 'sms', ${phone},
            ${`Test from ${b.name}: if you got this, texts from the app work. 🐾`}, 'test', 'queued')`;
  revalidatePath("/settings/messages");
  return { saved: true };
}
