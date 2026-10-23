"use server";
import { headers } from "next/headers";
import { isExclusionViolation, sql } from "@/lib/db";
import { findSlots, getPublicBusiness, onlineServices, zipProblem, type DaySlots, type PublicBusiness } from "@/lib/booking";
import { normalizePhone, phoneLabel, SIZES, ymd, dayLabel, timeLabel } from "@/lib/format";
import { notifyAppointment, notifyOwner } from "@/lib/messaging";
import { activeAgreement, currentSignature, recordSignature, signatureImage } from "@/lib/agreement";
import { bytesFromDataUrl, savePetPhoto } from "@/lib/pet-photos";

// The public booking page. Clients identify themselves with their mobile number: a known
// number brings up their pets and the address on file, so they don't type anything again.
// What this page reveals about a known number is kept small on purpose: first name, pet
// names and breeds, and the city (never the street). Every request still needs the owner's OK.

export type PetRequest = {
  petId?: string; // an existing pet of this client
  name: string;
  breed: string;
  size: string;
  serviceIds: string[];
  photo?: string; // data URL, already shrunk in the browser (new pets only)
};

export type KnownClient = {
  known: true;
  firstName: string;
  city: string | null;
  hasAddress: boolean;
  pets: { id: string; name: string; breed: string | null; size: string | null }[];
  mustSign: boolean;
};
export type LookupResult = { error?: string } & (KnownClient | { known: false; mustSign: boolean } | { known?: undefined });

// Best effort, per server instance: slows down anyone trying many numbers.
const lookups = new Map<string, number[]>();
async function tooManyLookups() {
  const h = await headers();
  // Netlify's own header can't be set by the browser; x-forwarded-for can.
  const ip = h.get("x-nf-client-connection-ip") ?? ((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local");
  const now = Date.now();
  const recent = (lookups.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  lookups.set(ip, recent);
  return recent.length > 20;
}

async function findClient(b: PublicBusiness, phone: string) {
  const [c] = await sql<{ id: string; first_name: string; city: string | null; zip: string | null; address_line: string | null; state: string | null;
                         online_booking_blocked: boolean }[]>`
    select id, first_name, city, zip, address_line, state, online_booking_blocked from clients
    where business_id = ${b.id} and phone = ${phone}`; // inactive clients too: booking makes them active again
  return c ?? null;
}

async function mustSignFor(b: PublicBusiness, clientId: string | null) {
  const agreement = await activeAgreement(b.id);
  if (!agreement?.required_online) return { agreement: null, mustSign: false };
  const signed = clientId ? await currentSignature(agreement, clientId) : null;
  return { agreement, mustSign: !signed };
}

export async function lookupClientAction(rawPhone: string): Promise<LookupResult> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: "Online booking is closed right now. Please text us." };
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "Please enter your 10-digit mobile number." };
  if (await tooManyLookups()) return { error: "Too many tries. Please wait a few minutes or text us." };
  const c = await findClient(b, phone);
  if (c?.online_booking_blocked) return { error: `Please text us at ${phoneLabel(b.phone)} to book your next visit.` };
  if (!c) return { known: false, mustSign: (await mustSignFor(b, null)).mustSign };
  const pets = await sql<{ id: string; name: string; breed: string | null; size: string | null }[]>`
    select id, name, breed, size_class as size from pets where client_id = ${c.id} and deceased_at is null order by name`;
  return {
    known: true,
    firstName: c.first_name,
    city: c.city,
    hasAddress: !!(c.address_line && c.zip),
    pets,
    mustSign: (await mustSignFor(b, c.id)).mustSign,
  };
}

/** Validates the pets and services picked on the page and returns their total length. */
async function priceAndLength(businessId: string, pets: PetRequest[]) {
  if (!Array.isArray(pets) || pets.length === 0 || pets.length > 4) return { error: "Choose between 1 and 4 pets." } as const;
  const services = await onlineServices(businessId);
  const byId = new Map(services.map((s) => [s.id, s]));
  let minutes = 0;
  for (const p of pets) {
    if (!String(p.name ?? "").trim()) return { error: "Each pet needs a name." } as const;
    if (!SIZES.some((s) => s.value === p.size)) return { error: `Pick ${p.name}'s size.` } as const;
    const mains = p.serviceIds.filter((id) => byId.get(id)?.kind === "service");
    if (mains.length !== 1) return { error: `Pick one service for ${p.name}.` } as const;
    for (const id of p.serviceIds) {
      const s = byId.get(id);
      if (!s) return { error: "One of the services is no longer available. Please refresh the page." } as const;
      if (s.size_class && s.size_class !== p.size) return { error: `That service doesn't match ${p.name}'s size.` } as const;
      minutes += s.duration_min;
    }
  }
  return { minutes, byId } as const;
}

/** The ZIP to plan around: the address on file for a known client, or the one typed in. */
async function zipFor(b: PublicBusiness, phone: string | null, useFileAddress: boolean, typedZip: string) {
  if (useFileAddress && phone) {
    const c = await findClient(b, phone);
    if (c?.zip) return c.zip;
  }
  return String(typedZip ?? "").trim();
}

export async function availabilityAction(input: {
  phone: string;
  useFileAddress: boolean;
  zip: string;
  pets: PetRequest[];
}): Promise<{ error?: string; days?: DaySlots[] }> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: "Online booking is closed right now. Please text us." };
  const zip = await zipFor(b, normalizePhone(input.phone), input.useFileAddress, input.zip);
  const problem = zipProblem(b, zip);
  if (problem) return { error: problem };
  const checked = await priceAndLength(b.id, input.pets);
  if ("error" in checked) return { error: checked.error };
  const days = await findSlots(b, zip, checked.minutes);
  if (days.length === 0) return { error: "No open times in your area right now. Please text us and we'll fit you in." };
  return { days };
}

export type BookingRequest = {
  phone: string;
  pets: PetRequest[];
  start: string; // ISO time picked from the list
  useFileAddress: boolean;
  address: string;
  city: string;
  zip: string;
  firstName: string; // new clients only
  lastName: string;
  email: string;
  notes: string;
  smsConsent: boolean;
  agreed: boolean;
  signature: string; // full name typed to sign the service agreement
  signatureDrawing?: string; // the signature drawn with a finger, as a PNG data URL
  website: string; // honeypot: people never see this field
};

export async function requestBookingAction(input: BookingRequest): Promise<{ error?: string; ok?: boolean; when?: string }> {
  const b = await getPublicBusiness();
  if (!b || !b.online_booking_enabled) return { error: "Online booking is closed right now. Please text us." };
  if (input.website) return { ok: true }; // a bot filled the hidden field; pretend it worked

  const phone = normalizePhone(input.phone);
  if (!phone) return { error: "Please enter a 10-digit mobile number." };
  const existing = await findClient(b, phone);
  if (existing?.online_booking_blocked) return { error: `Please text us at ${phoneLabel(b.phone)} to book your next visit.` };
  const useFile = !!existing && input.useFileAddress && !!existing.zip && !!existing.address_line;

  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const address = String(input.address ?? "").trim();
  const city = String(input.city ?? "").trim();
  const notes = String(input.notes ?? "").trim().slice(0, 1000) || null;
  if (!existing && !firstName) return { error: "Please enter your first name." };
  if (!existing && !email) return { error: "Please enter your email address." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Please check your email address." };
  if (!useFile && (!address || !city)) return { error: "Please enter your street address and city." };
  const zip = useFile ? existing!.zip! : String(input.zip ?? "").trim();
  const problem = zipProblem(b, zip);
  if (problem) return { error: problem };

  const checked = await priceAndLength(b.id, input.pets);
  if ("error" in checked) return { error: checked.error };
  if (existing) {
    const ids = input.pets.map((p) => p.petId).filter((x): x is string => !!x);
    const own = ids.length ? await sql`select id from pets where client_id = ${existing.id} and id = any(${ids})` : [];
    if (own.length !== new Set(ids).size) return { error: "Please refresh the page and pick your pets again." };
  } else if (input.pets.some((p) => p.petId)) {
    return { error: "Please refresh the page and pick your pets again." };
  }

  const { agreement, mustSign } = await mustSignFor(b, existing?.id ?? null);
  const signature = String(input.signature ?? "").trim();
  if (mustSign && (!input.agreed || signature.length < 3)) {
    return { error: "Please read the service agreement, tick the box and type your full name." };
  }

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) return { error: "Please pick a time." };
  // The time must still be open under the same rules the page used.
  const open = (await findSlots(b, zip, checked.minutes, ymd(start, b.timezone))).flatMap((d) => d.times.map((t) => t.value));
  if (!open.includes(start.toISOString())) return { error: "Sorry, that time was just taken. Please pick another one." };
  const end = new Date(start.getTime() + Math.max(checked.minutes, 15) * 60_000);

  // At most 3 online requests per phone number per day.
  const [{ recent }] = await sql`
    select count(*)::int as recent from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${b.id} and a.source = 'online' and c.phone = ${phone} and a.created_at > now() - interval '1 day'`;
  if (recent >= 3) return { error: "You already sent a few requests today. We'll be in touch soon!" };

  const newPetPhotos: { petId: string; photo: string }[] = [];
  let appointmentId: string;
  try {
    appointmentId = await sql.begin(async (tx) => {
      let clientId: string;
      if (existing) {
        clientId = existing.id;
        await tx`update clients set archived_at = null where id = ${clientId} and archived_at is not null`;
        if (input.smsConsent) {
          await tx`update clients set sms_consent_at = coalesce(sms_consent_at, now()) where id = ${clientId} and sms_opted_out_at is null`;
        }
      } else {
        const [c] = await tx`
          insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip,
                               sms_consent_at, source)
          values (${b.id}, ${firstName}, ${lastName}, ${phone}, ${email || null}, ${address}, ${city}, 'CA', ${zip},
                  ${input.smsConsent ? new Date() : null}, 'online')
          returning id`;
        clientId = c.id;
      }
      if (mustSign && agreement) await recordSignature(tx, agreement, clientId, signature, signatureImage(input.signatureDrawing));

      // A known client who typed a different address: keep the file as is, tell the owner.
      const visitAddress = useFile
        ? [existing!.address_line, existing!.city, existing!.state].filter(Boolean).join(", ")
        : `${address}, ${city}, CA`;
      const moved = existing && !useFile ? `New address given online: ${address}, ${city}, CA ${zip}.` : null;
      const [appt] = await tx`
        insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, source, address_line, zip, notes)
        values (${b.id}, ${clientId}, ${b.staff_id}, ${start}, ${end}, 'requested', 'online', ${visitAddress}, ${zip},
                ${[moved, notes].filter(Boolean).join("\n") || null})
        returning id`;

      for (const p of input.pets) {
        let petId: string;
        if (p.petId) {
          petId = p.petId;
          // The client told us the size; remember it if we didn't know it yet.
          await tx`update pets set size_class = coalesce(size_class, ${p.size}) where id = ${petId}`;
        } else {
          const [pet] = await tx`
            insert into pets (client_id, name, breed, size_class)
            values (${clientId}, ${p.name.trim().slice(0, 80)}, ${p.breed.trim().slice(0, 120) || null}, ${p.size})
            returning id`;
          petId = pet.id;
          if (p.photo) newPetPhotos.push({ petId, photo: p.photo });
        }
        const [ap] = await tx`insert into appointment_pets (appointment_id, pet_id) values (${appt.id}, ${petId}) returning id`;
        for (const sid of p.serviceIds) {
          const s = checked.byId.get(sid)!;
          await tx`insert into appointment_services (appointment_pet_id, service_id, name, price_cents, duration_min)
                   values (${ap.id}, ${s.id}, ${s.name}, ${s.price_cents}, ${s.duration_min})`;
        }
      }
      return appt.id as string;
    });
  } catch (e) {
    if (isExclusionViolation(e)) return { error: "Sorry, that time was just taken. Please pick another one." };
    throw e;
  }

  // Photos are optional: a bad one never blocks the booking.
  for (const { petId, photo } of newPetPhotos) {
    const bytes = bytesFromDataUrl(photo);
    if (bytes) await savePetPhoto(petId, bytes).catch(() => null);
  }

  // The booking went through: it's no longer an abandoned one.
  await sql`update booking_drafts set completed_at = now()
            where business_id = ${b.id} and phone = ${phone} and completed_at is null`;
  await notifyAppointment(appointmentId, "request_received");
  const when = `${dayLabel(start, b.timezone)} ${timeLabel(start, b.timezone)}`;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const who = existing ? `${existing.first_name} (existing client)` : `${firstName} ${lastName} (new client)`;
  await notifyOwner(
    b.id,
    `New booking request: ${input.pets.map((p) => p.name).join(" & ")}, ${when}`,
    `${who}, ${input.phone}, asked for ${when}.\nAccept or decline: ${appUrl}/requests`,
    "/requests",
  );
  return { ok: true, when: `${dayLabel(start, b.timezone)} at ${timeLabel(start, b.timezone)}` };
}

export type DraftStep = "phone" | "contact" | "address" | "times" | "review";

/**
 * Remembers how far someone got on the booking page (one row per phone, refreshed as they
 * go), so they can get a "finish booking" message if they stop. Best effort: never fails.
 */
export type DraftPet = { name: string; breed: string; size: string; service: string; addons: string[] };

export async function trackDraftAction(input: {
  phone: string; step: DraftStep; firstName?: string; lastName?: string; email?: string; zip?: string; pets?: string;
  addressLine?: string; city?: string; petDetails?: DraftPet[]; start?: string;
}) {
  try {
    const b = await getPublicBusiness();
    const phone = normalizePhone(input.phone);
    if (!b || !phone || !["phone", "contact", "address", "times", "review"].includes(input.step)) return;
    const cut = (v: string | undefined, n: number) => (v ?? "").trim().slice(0, n) || null;
    const email = cut(input.email, 120)?.toLowerCase() ?? null;
    const known = await findClient(b, phone);
    const fields = {
      first_name: cut(input.firstName, 60) ?? known?.first_name ?? null,
      last_name: cut(input.lastName, 60),
      email: email && /^\S+@\S+\.\S+$/.test(email) ? email : null,
      zip: cut(input.zip, 10),
      pets: cut(input.pets, 200),
      address_line: cut(input.addressLine, 120),
      city: cut(input.city, 60),
      pet_details: Array.isArray(input.petDetails)
        ? input.petDetails.slice(0, 4).map((p) => ({
            name: String(p.name ?? "").slice(0, 40), breed: String(p.breed ?? "").slice(0, 60), size: String(p.size ?? "").slice(0, 20),
            service: String(p.service ?? "").slice(0, 80), addons: (Array.isArray(p.addons) ? p.addons : []).slice(0, 6).map((a) => String(a).slice(0, 60)),
          }))
        : null,
      chosen_start: input.start && !Number.isNaN(Date.parse(input.start)) ? new Date(input.start) : null,
    };
    const [open] = await sql`
      select id from booking_drafts where business_id = ${b.id} and phone = ${phone} and completed_at is null
        and created_at > now() - interval '2 days'
      order by created_at desc limit 1`;
    if (open) {
      await sql`
        update booking_drafts set step = ${input.step}, updated_at = now(), client_id = ${known?.id ?? null},
          first_name = coalesce(${fields.first_name}, first_name), last_name = coalesce(${fields.last_name}, last_name),
          email = coalesce(${fields.email}, email), zip = coalesce(${fields.zip}, zip), pets = coalesce(${fields.pets}, pets),
          address_line = coalesce(${fields.address_line}, address_line), city = coalesce(${fields.city}, city),
          pet_details = coalesce(${fields.pet_details ? sql.json(fields.pet_details) : null}::jsonb, pet_details),
          chosen_start = coalesce(${fields.chosen_start}, chosen_start)
        where id = ${open.id}`;
    } else {
      await sql`
        insert into booking_drafts (business_id, client_id, phone, first_name, last_name, email, zip, pets, step,
                                    address_line, city, pet_details, chosen_start)
        values (${b.id}, ${known?.id ?? null}, ${phone}, ${fields.first_name}, ${fields.last_name}, ${fields.email},
                ${fields.zip}, ${fields.pets}, ${input.step}, ${fields.address_line}, ${fields.city},
                ${fields.pet_details ? sql.json(fields.pet_details) : null}, ${fields.chosen_start})`;
    }
  } catch (e) {
    console.error("draft tracking failed", e);
  }
}
