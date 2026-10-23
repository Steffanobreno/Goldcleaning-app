"use server";
import { isExclusionViolation, sql } from "@/lib/db";
import { findSlots, getPublicBusiness, zipProblem, type DaySlots } from "@/lib/booking";
import { loadCatalog } from "@/lib/data/catalog";
import { insertAppointment } from "@/lib/data/appointment-write";
import type { DraftDetails } from "@/lib/data/abandoned";
import { ACCESS_METHODS, type AccessMethod } from "@/lib/home-options";
import { dayLabel, money, normalizePhone, phoneLabel, timeLabel, ymd } from "@/lib/format";
import { durationMinutes, FREQUENCIES, FREQUENCY_LABEL, quote, type Catalog, type Frequency, type HomeSize } from "@/lib/pricing";
import { notifyAppointment, notifyOwner, notifyQuote } from "@/lib/messaging";

// The public booking page. Nothing here tells a visitor whether a phone number is already a
// client: a known number is matched only when the request is saved, and every request still
// needs the owner's OK. The price is always worked out again here from the current price list.

const CLOSED = "Online booking is closed right now. Please call or text us.";

/** Open days and times for a home of this many bedrooms (which sets the visit length). */
export async function slotsAction(bedrooms: number): Promise<{ error?: string; days?: DaySlots[] }> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: CLOSED };
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 7) return { error: "Please choose the number of bedrooms." };
  const { rule } = await loadCatalog(b.id, { onlineOnly: true });
  const days = await findSlots(b, durationMinutes({ bedrooms, fullBaths: 1, halfBaths: 0 }, rule));
  if (days.length === 0) return { error: `No open times right now. Please call or text us at ${phoneLabel(b.phone)}.` };
  return { days };
}

export type Contact = { firstName: string; lastName: string; email: string; phone: string };
export type Choice = { serviceId: string; frequency: Frequency; home: HomeSize; extras: { serviceId: string; qty: number }[] };

/**
 * Remembers how far someone got (one row per phone, refreshed as they go), so the owner sees
 * abandoned bookings and they get one "finish booking" email. Best effort: never fails.
 */
export async function saveDraftAction(input: {
  contact: Contact;
  step: string;
  choice: Choice;
  zip?: string;
  addressLine?: string;
  city?: string;
  start?: string;
}) {
  try {
    const b = await getPublicBusiness();
    const phone = normalizePhone(input.contact?.phone);
    if (!b || !phone || !["contact", "date", "address", "access", "review"].includes(input.step)) return;
    const cut = (v: string | undefined, n: number) => String(v ?? "").trim().slice(0, n) || null;
    const email = cut(input.contact.email, 120)?.toLowerCase() ?? null;
    // Out-of-area ZIPs are not kept: those visitors were told to call instead.
    const zip = cut(input.zip, 10);
    const zipOk = zip && !zipProblem(b, zip) ? zip : null;
    const catalog = await loadCatalog(b.id, { onlineOnly: true });
    const q = quote(catalog, input.choice);
    const details: DraftDetails | null =
      "error" in q
        ? null
        : {
            service: q.service.name,
            frequency: FREQUENCY_LABEL[input.choice.frequency],
            bedrooms: input.choice.home.bedrooms,
            fullBaths: input.choice.home.fullBaths,
            halfBaths: input.choice.home.halfBaths,
            extras: q.lines.filter((l) => l.kind === "extra").map((l) => (l.qty > 1 ? `${l.label} × ${l.qty}` : l.label)),
            totalCents: q.totalCents,
          };
    const summary = details
      ? `${details.service} · ${details.frequency} · ${details.bedrooms || "Studio"}${details.bedrooms ? " bd" : ""} / ${details.fullBaths} ba`
      : null;
    const [known] = await sql`select id, first_name from clients where business_id = ${b.id} and phone = ${phone}`;
    const start = input.start && !Number.isNaN(Date.parse(input.start)) ? new Date(input.start) : null;
    const f = {
      first_name: cut(input.contact.firstName, 60),
      last_name: cut(input.contact.lastName, 60),
      email: email && /^\S+@\S+\.\S+$/.test(email) ? email : null,
      address_line: zipOk ? cut(input.addressLine, 120) : null,
      city: zipOk ? cut(input.city, 60) : null,
    };
    const [open] = await sql`
      select id from booking_drafts where business_id = ${b.id} and phone = ${phone} and completed_at is null
        and created_at > now() - interval '2 days'
      order by created_at desc limit 1`;
    if (open) {
      await sql`
        update booking_drafts set step = ${input.step}, updated_at = now(), client_id = ${known?.id ?? null},
          first_name = coalesce(${f.first_name}, first_name), last_name = coalesce(${f.last_name}, last_name),
          email = coalesce(${f.email}, email), zip = coalesce(${zipOk}, zip), summary = coalesce(${summary}, summary),
          address_line = coalesce(${f.address_line}, address_line), city = coalesce(${f.city}, city),
          details = coalesce(${details ? sql.json(details) : null}::jsonb, details),
          chosen_start = coalesce(${start}, chosen_start)
        where id = ${open.id}`;
    } else {
      await sql`
        insert into booking_drafts (business_id, client_id, phone, first_name, last_name, email, zip, summary, step,
                                    address_line, city, details, chosen_start)
        values (${b.id}, ${known?.id ?? null}, ${phone}, ${f.first_name ?? known?.first_name ?? null}, ${f.last_name}, ${f.email},
                ${zipOk}, ${summary}, ${input.step}, ${f.address_line}, ${f.city}, ${details ? sql.json(details) : null}, ${start})`;
    }
  } catch (e) {
    console.error("draft tracking failed", e);
  }
}

export type BookingRequest = {
  contact: Contact;
  choice: Choice;
  start: string; // ISO time picked from the list
  address: { line: string; apt: string; city: string; zip: string };
  access: { method: string; code: string; parking: string; pets: string; notes: string };
  shownTotalCents: number; // the total the client saw; a different one means the prices changed
  website: string; // honeypot: people never see this field
};

export type BookingResult =
  | { ok: true; when: string }
  | { error: string; newTotalCents?: number; catalog?: Catalog; taken?: boolean };

export async function requestBookingAction(input: BookingRequest): Promise<BookingResult> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: CLOSED };
  if (input.website) return { ok: true, when: "" }; // a bot filled the hidden field; pretend it worked

  const c = input.contact ?? ({} as Contact);
  const phone = normalizePhone(c.phone);
  const firstName = String(c.firstName ?? "").trim().slice(0, 60);
  const lastName = String(c.lastName ?? "").trim().slice(0, 60);
  const email = String(c.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!firstName) return { error: "Please enter your first name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please check your email address." };
  if (!phone) return { error: "Please enter a 10-digit mobile number." };

  const line = String(input.address?.line ?? "").trim().slice(0, 120);
  const apt = String(input.address?.apt ?? "").trim().slice(0, 30);
  const city = String(input.address?.city ?? "").trim().slice(0, 60);
  const zip = String(input.address?.zip ?? "").trim();
  if (!line || !city) return { error: "Please enter your street address and city." };
  const problem = zipProblem(b, zip);
  if (problem) return { error: problem };

  const method = String(input.access?.method ?? "");
  if (!ACCESS_METHODS.some((m) => m.value === method)) return { error: "Please tell us how we'll get in." };
  const cut = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n) || null;
  const access = {
    method: method as AccessMethod,
    code: cut(input.access.code, 60),
    parking: cut(input.access.parking, 200),
    pets: cut(input.access.pets, 200),
    notes: cut(input.access.notes, 1000),
  };

  const ch = input.choice;
  if (!ch || !FREQUENCIES.includes(ch.frequency)) return { error: "Please choose how often." };
  const catalog = await loadCatalog(b.id, { onlineOnly: true });
  const q = quote(catalog, { serviceId: ch.serviceId, frequency: ch.frequency, home: ch.home, extras: Array.isArray(ch.extras) ? ch.extras : [] });
  if ("error" in q) return { error: q.error };
  if (q.totalCents !== input.shownTotalCents) {
    return {
      error: `Our prices were just updated. Your new total is ${money(q.totalCents)}. Please check it and press Request booking again.`,
      newTotalCents: q.totalCents,
      catalog,
    };
  }

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) return { error: "Please pick a day and time." };
  const taken = { error: "Sorry, that time was just taken. Please pick another one.", taken: true } as const;
  // The time must still be open under the same rules the page used.
  const open = (await findSlots(b, q.durationMin, ymd(start, b.timezone))).flatMap((d) => d.times.map((t) => t.value));
  if (!open.includes(start.toISOString())) return taken;

  // At most 3 online requests per phone number per day.
  const [{ recent }] = await sql`
    select count(*)::int as recent from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${b.id} and a.source = 'online' and c.phone = ${phone} and a.created_at > now() - interval '1 day'`;
  if (recent >= 3) return { error: "You already sent a few requests today. We'll be in touch soon!" };

  const addressLine = apt ? `${line}, ${/^(apt|unit|#|suite)/i.test(apt) ? apt : `Apt ${apt}`}` : line;
  let existing = false;
  let appointmentId: string;
  try {
    appointmentId = await sql.begin(async (tx) => {
      const [known] = await tx`select id, online_booking_blocked from clients where business_id = ${b.id} and phone = ${phone}`;
      if (known?.online_booking_blocked) throw new Blocked();
      let clientId: string;
      if (known) {
        existing = true;
        clientId = known.id;
        // Booking makes an inactive client active again; an email on file is kept.
        await tx`update clients set archived_at = null, email = coalesce(email, ${email}) where id = ${clientId}`;
      } else {
        const [row] = await tx`
          insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip, source)
          values (${b.id}, ${firstName}, ${lastName}, ${phone}, ${email}, ${addressLine}, ${city}, 'CA', ${zip}, 'online')
          returning id`;
        clientId = row.id;
      }
      // The same address is the same home: refresh what they told us. Otherwise a new home.
      const home = {
        address_line: addressLine,
        city,
        state: "CA",
        zip,
        bedrooms: ch.home.bedrooms,
        full_baths: ch.home.fullBaths,
        half_baths: ch.home.halfBaths,
        access_method: access.method,
        access_code: access.code,
        parking_notes: access.parking,
        pets_in_home: access.pets,
      };
      const [same] = await tx`
        select id from homes where client_id = ${clientId} and archived_at is null
          and lower(address_line) = lower(${addressLine}) and zip = ${zip} limit 1`;
      const homeId = same
        ? ((await tx`update homes set ${tx(home)} where id = ${same.id} returning id`)[0].id as string)
        : ((await tx`insert into homes ${tx({ ...home, client_id: clientId })} returning id`)[0].id as string);
      return insertAppointment(tx, {
        businessId: b.id,
        clientId,
        staffId: b.staff_id,
        homeId,
        serviceId: q.service.id,
        frequency: ch.frequency,
        startAt: start,
        durationMin: q.durationMin,
        status: "requested",
        source: "online",
        notes: access.notes,
        lines: q.lines,
      });
    });
  } catch (e) {
    if (e instanceof Blocked) return { error: `Please call or text us at ${phoneLabel(b.phone)} to book your next cleaning.` };
    if (isExclusionViolation(e)) return taken;
    throw e;
  }

  // The booking went through: it's no longer an abandoned one.
  await sql`update booking_drafts set completed_at = now()
            where business_id = ${b.id} and phone = ${phone} and completed_at is null`;
  await notifyAppointment(appointmentId, "request_received");
  const when = `${dayLabel(start, b.timezone)} ${timeLabel(start, b.timezone)}`;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  await notifyOwner(
    b.id,
    `New booking request: ${firstName} ${lastName}, ${when}`,
    `${firstName} ${lastName} (${existing ? "existing client" : "new client"}), ${phoneLabel(phone)}, asked for ${q.service.name} ` +
      `(${FREQUENCY_LABEL[ch.frequency]}) on ${when}, ${money(q.totalCents)}.\nAccept or decline: ${appUrl}/requests`,
    "/requests",
  );
  return { ok: true, when: `${dayLabel(start, b.timezone)} at ${timeLabel(start, b.timezone)}` };
}

class Blocked extends Error {}

export type QuoteRequest = {
  serviceId: string; // Airbnb Turnover or Office Cleaning
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  zip: string;
  bedrooms: number | null;
  fullBaths: number | null;
  squareFeet: number | null;
  frequency: string;
  message: string;
  photos: string[]; // data URLs, shrunk in the browser, at most 5
  website: string; // honeypot
};

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTOS = 5;

/** Saves a quote request (Airbnb or office), emails the client and tells the owner. */
export async function requestQuoteAction(input: QuoteRequest): Promise<{ ok: true } | { error: string }> {
  const b = await getPublicBusiness();
  if (!b) return { error: CLOSED };
  if (input.website) return { ok: true };
  const [svc] = await sql<{ name: string }[]>`
    select name from services where id = ${String(input.serviceId ?? "")}::uuid and business_id = ${b.id} and pricing = 'quote'`.catch(() => []);
  if (!svc) return { error: "Please choose Airbnb Turnover or Office Cleaning." };
  const kind = /office/i.test(svc.name) ? "office" : "airbnb";
  const phone = normalizePhone(input.phone);
  const cut = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const firstName = cut(input.firstName, 60);
  const email = cut(input.email, 120).toLowerCase();
  const zip = cut(input.zip, 5);
  const message = cut(input.message, 3000);
  if (!firstName) return { error: "Please enter your first name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please check your email address." };
  if (!phone) return { error: "Please enter a 10-digit phone number." };
  if (!/^\d{5}$/.test(zip)) return { error: "Please enter the ZIP code of the place." };
  const problem = zipProblem(b, zip);
  if (problem) return { error: problem };
  if (!message) return { error: "Please tell us a little about what you need." };
  const count = (v: unknown, max: number) => {
    const n = Number(v);
    return v === null || v === "" || !Number.isInteger(n) || n < 0 || n > max ? null : n;
  };
  const photos = (Array.isArray(input.photos) ? input.photos : []).slice(0, MAX_PHOTOS).flatMap((url) => {
    const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(url));
    if (!m || !PHOTO_TYPES.includes(m[1])) return [];
    const data = Buffer.from(m[2], "base64");
    return data.length > 0 && data.length <= 1_500_000 ? [{ content_type: m[1], data }] : [];
  });

  const [{ recent }] = await sql`
    select count(*)::int as recent from quote_requests
    where business_id = ${b.id} and phone = ${phone} and created_at > now() - interval '1 day'`;
  if (recent >= 3) return { error: "You already sent a few requests today. We'll be in touch soon!" };

  const id = await sql.begin(async (tx) => {
    const [q] = await tx`
      insert into quote_requests (business_id, kind, first_name, last_name, email, phone, city, zip, bedrooms, full_baths,
                                  square_feet, frequency, message)
      values (${b.id}, ${kind}, ${firstName}, ${cut(input.lastName, 60)}, ${email}, ${phone}, ${cut(input.city, 60) || null}, ${zip},
              ${count(input.bedrooms, 20)}, ${count(input.fullBaths, 20)}, ${count(input.squareFeet, 1_000_000)},
              ${cut(input.frequency, 40) || null}, ${message})
      returning id`;
    for (const p of photos) {
      await tx`insert into quote_request_photos (quote_request_id, content_type, data) values (${q.id}, ${p.content_type}, ${p.data})`;
    }
    return q.id as string;
  });
  await notifyQuote(id);
  return { ok: true };
}
