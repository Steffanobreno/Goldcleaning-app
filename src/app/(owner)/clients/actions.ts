"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { geocode } from "@/lib/maps";
import { ACCESS_METHODS, upsertHome, type AccessMethod, type HomeInput } from "@/lib/data/homes";

export type FormState = { error?: string } | undefined;

const text = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? "").trim();
  return v === "" ? null : v;
};

function readClient(form: FormData) {
  const first_name = text(form, "first_name");
  const phone = normalizePhone(form.get("phone"));
  if (!first_name) return { error: "First name is required." } as const;
  if (!phone) return { error: "Enter a 10-digit US phone number." } as const;
  return {
    values: {
      first_name,
      last_name: text(form, "last_name") ?? "",
      phone,
      email: text(form, "email"),
      address_line: text(form, "address_line"),
      city: text(form, "city"),
      state: text(form, "state") ?? "CA",
      zip: text(form, "zip"),
      access_notes: text(form, "access_notes"),
    },
  } as const;
}

async function locate(v: { address_line: string | null; city: string | null; state: string | null; zip: string | null }) {
  const address = [v.address_line, v.city, v.state, v.zip].filter(Boolean).join(", ");
  return v.address_line ? geocode(address) : null;
}

export async function createClientAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readClient(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const geo = await locate(v);
  let id: string;
  try {
    const [row] = await sql`
      insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip,
                           lat, lng, access_notes, source)
      values (${staff.businessId}, ${v.first_name}, ${v.last_name}, ${v.phone}, ${v.email}, ${v.address_line},
              ${v.city ?? geo?.city ?? null}, ${v.state}, ${v.zip ?? geo?.zip ?? null}, ${geo?.lat ?? null},
              ${geo?.lng ?? null}, ${v.access_notes}, 'manual')
      returning id`;
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "A client with this phone number already exists." };
    throw e;
  }
  redirect(`/clients/${id}/homes/new?first=1`);
}

export async function updateClientAction(clientId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readClient(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const geo = await locate(v);
  try {
    const rows = await sql`
      update clients set first_name = ${v.first_name}, last_name = ${v.last_name}, phone = ${v.phone},
        email = ${v.email}, address_line = ${v.address_line}, city = ${v.city ?? geo?.city ?? null},
        state = ${v.state}, zip = ${v.zip ?? geo?.zip ?? null}, lat = ${geo?.lat ?? null}, lng = ${geo?.lng ?? null},
        access_notes = ${v.access_notes}
      where id = ${clientId} and business_id = ${staff.businessId}
      returning id`;
    if (rows.length === 0) return { error: "Client not found." };
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Another client already has this phone number." };
    throw e;
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function addNoteAction(clientId: string, form: FormData) {
  const staff = await requireStaff();
  const body = text(form, "body");
  if (!body) return;
  await sql`
    insert into client_notes (client_id, staff_id, body)
    select id, ${staff.staffId}, ${body} from clients where id = ${clientId} and business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
}

const count = (form: FormData, key: string, min: number, max: number) => {
  const n = Number(form.get(key));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

function readHome(form: FormData) {
  const bedrooms = count(form, "bedrooms", 0, 7);
  const full_baths = count(form, "full_baths", 1, 7);
  const half_baths = count(form, "half_baths", 0, 7);
  if (bedrooms === null || full_baths === null || half_baths === null)
    return { error: "Check the bedrooms and bathrooms (0–7 bedrooms, 1–7 full baths)." } as const;
  const method = text(form, "access_method");
  const access_method = ACCESS_METHODS.some((a) => a.value === method) ? (method as AccessMethod) : null;
  const values: HomeInput = {
    label: text(form, "label") ?? "Home",
    address_line: text(form, "address_line"),
    city: text(form, "city"),
    state: text(form, "state") ?? "CA",
    zip: text(form, "zip"),
    bedrooms,
    full_baths,
    half_baths,
    access_method,
    access_code: text(form, "access_code"),
    parking_notes: text(form, "parking_notes"),
    pets_in_home: text(form, "pets_in_home"),
    product_preferences: text(form, "product_preferences"),
    notes: text(form, "notes"),
  };
  return { values } as const;
}

export async function saveHomeAction(clientId: string, homeId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readHome(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const geo = await locate(v);
  const id = await upsertHome(
    staff,
    clientId,
    { ...v, city: v.city ?? geo?.city ?? null, zip: v.zip ?? geo?.zip ?? null, lat: geo?.lat ?? null, lng: geo?.lng ?? null },
    homeId ?? undefined,
  );
  if (!id) return { error: "Client not found." };
  revalidatePath(`/clients/${clientId}`);
  redirect(form.get("then") === "book" ? `/appointments/new?client=${clientId}&home=${id}` : `/clients/${clientId}`);
}

/** Hides a home the client no longer has (sold, moved out); its past visits stay. */
export async function archiveHomeAction(clientId: string, homeId: string) {
  const staff = await requireStaff();
  await sql`update homes h set archived_at = now()
            from clients c where c.id = h.client_id and h.id = ${homeId} and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

/** The switches under "Business control" on the client profile. */
export async function setClientControlAction(
  clientId: string, control: "inactive" | "block_messages" | "block_online" | "no_marketing", on: boolean,
) {
  const staff = await requireStaff();
  if (control === "inactive") {
    await sql`update clients set archived_at = ${on ? new Date() : null} where id = ${clientId} and business_id = ${staff.businessId}`;
  } else if (control === "block_messages") {
    await sql`update clients set sms_opted_out_at = ${on ? new Date() : null} where id = ${clientId} and business_id = ${staff.businessId}`;
  } else if (control === "no_marketing") {
    await sql`update clients set email_unsubscribed_at = ${on ? new Date() : null} where id = ${clientId} and business_id = ${staff.businessId}`;
  } else {
    await sql`update clients set online_booking_blocked = ${on} where id = ${clientId} and business_id = ${staff.businessId}`;
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function deleteNoteAction(clientId: string, noteId: string) {
  const staff = await requireStaff();
  await sql`delete from client_notes n using clients c
            where n.id = ${noteId} and c.id = n.client_id and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
}

/**
 * Removes a client for good: their homes, visits, bills and payments, notes and signatures.
 * Messages already sent stay in the log without the name. Can't be undone.
 */
export async function deleteClientAction(clientId: string) {
  const staff = await requireStaff();
  await sql.begin(async (tx) => {
    const [c] = await tx`select id from clients where id = ${clientId} and business_id = ${staff.businessId} for update`;
    if (!c) return;
    await tx`delete from payments where invoice_id in (select id from invoices where client_id = ${clientId})`;
    await tx`delete from invoices where client_id = ${clientId}`;
    await tx`delete from appointments where client_id = ${clientId}`;
    await tx`delete from clients where id = ${clientId}`;
  });
  revalidatePath("/clients");
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath("/reports");
  redirect("/clients?removed=1");
}

/**
 * A home's standing price: an adjustment in dollars (+ or −) added to every visit booked for it,
 * and the discounts that always apply to it. Visits already booked keep their prices.
 */
export async function saveHomePriceAction(
  clientId: string, homeId: string, _: { error?: string; saved?: boolean } | undefined, form: FormData,
): Promise<{ error?: string; saved?: boolean }> {
  const staff = await requireStaff();
  const [home] = await sql`
    select h.id from homes h join clients c on c.id = h.client_id
    where h.id = ${homeId} and h.client_id = ${clientId} and c.business_id = ${staff.businessId}`;
  if (!home) return { error: "Home not found." };
  const typed = String(form.get("adjustment") ?? "").replace(/[$,\s]/g, "");
  const cents = typed === "" ? 0 : Math.round(Number(typed) * 100);
  if (!Number.isFinite(cents) || Math.abs(cents) > 1_000_000) return { error: "Enter the adjustment like -20 or 15.50." };
  const note = String(form.get("note") ?? "").trim().slice(0, 80) || null;
  const picked = [...form.keys()].filter((k) => k.startsWith("d:")).map((k) => k.slice(2));
  const valid = picked.length
    ? await sql<{ id: string }[]>`select id from discounts where business_id = ${staff.businessId} and id = any(${picked}::uuid[])`
    : [];
  await sql.begin(async (tx) => {
    await tx`update homes set price_adjust_cents = ${cents}, price_adjust_note = ${cents ? note : null} where id = ${homeId}`;
    await tx`delete from home_discounts where home_id = ${homeId}`;
    for (const d of valid) await tx`insert into home_discounts (home_id, discount_id) values (${homeId}, ${d.id})`;
  });
  revalidatePath(`/clients/${clientId}`);
  return { saved: true };
}
