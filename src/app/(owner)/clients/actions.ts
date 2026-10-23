"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isUniqueViolation, sql } from "@/lib/db";
import { normalizePhone, SIZES } from "@/lib/format";
import { geocode } from "@/lib/maps";
import { savePetPhoto } from "@/lib/pet-photos";

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
      // The client agreed to texts when the owner ticks this (TCPA).
      sms_consent: form.get("sms_consent") === "on",
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
                           lat, lng, access_notes, sms_consent_at, source)
      values (${staff.businessId}, ${v.first_name}, ${v.last_name}, ${v.phone}, ${v.email}, ${v.address_line},
              ${v.city ?? geo?.city ?? null}, ${v.state}, ${v.zip ?? geo?.zip ?? null}, ${geo?.lat ?? null},
              ${geo?.lng ?? null}, ${v.access_notes}, ${v.sms_consent ? new Date() : null}, 'manual')
      returning id`;
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "A client with this phone number already exists." };
    throw e;
  }
  redirect(`/clients/${id}/pets/new?first=1`);
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
        access_notes = ${v.access_notes},
        sms_consent_at = case when ${v.sms_consent} then coalesce(sms_consent_at, now()) else null end
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

function readPet(form: FormData) {
  const name = text(form, "name");
  if (!name) return { error: "The pet's name is required." } as const;
  const size = text(form, "size_class");
  if (size && !SIZES.some((s) => s.value === size)) return { error: "Pick a size from the list." } as const;
  const weight = text(form, "weight_lbs");
  const rebook = text(form, "rebook_every_days");
  const rebookDays = rebook ? Number(rebook) : null;
  if (rebookDays !== null && !(rebookDays >= 7 && rebookDays <= 365))
    return { error: "Grooming frequency must be between 7 and 365 days." } as const;
  return {
    values: {
      name,
      breed: text(form, "breed"),
      size_class: size,
      weight_lbs: weight && Number.isFinite(Number(weight)) ? Number(weight) : null,
      coat_type: text(form, "coat_type"),
      birth_date: text(form, "birth_date"),
      sex: text(form, "sex"),
      behavior: text(form, "behavior"),
      vet_name: text(form, "vet_name"),
      vet_phone: text(form, "vet_phone"),
      notes: text(form, "notes"),
      rebook_every_days: rebookDays,
    },
  } as const;
}

export async function savePetAction(clientId: string, petId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = readPet(form);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.values;
  const [owner] = await sql`select id from clients where id = ${clientId} and business_id = ${staff.businessId}`;
  if (!owner) return { error: "Client not found." };
  if (petId) {
    await sql`
      update pets set name = ${v.name}, breed = ${v.breed}, size_class = ${v.size_class}, weight_lbs = ${v.weight_lbs},
        coat_type = ${v.coat_type}, birth_date = ${v.birth_date}, sex = ${v.sex}, behavior = ${v.behavior},
        vet_name = ${v.vet_name}, vet_phone = ${v.vet_phone}, notes = ${v.notes}, rebook_every_days = ${v.rebook_every_days}
      where id = ${petId} and client_id = ${clientId}`;
  } else {
    await sql`
      insert into pets (client_id, name, breed, size_class, weight_lbs, coat_type, birth_date, sex, behavior,
                        vet_name, vet_phone, notes, rebook_every_days)
      values (${clientId}, ${v.name}, ${v.breed}, ${v.size_class}, ${v.weight_lbs}, ${v.coat_type}, ${v.birth_date},
              ${v.sex}, ${v.behavior}, ${v.vet_name}, ${v.vet_phone}, ${v.notes}, ${v.rebook_every_days})`;
  }
  revalidatePath(`/clients/${clientId}`);
  redirect(form.get("then") === "book" ? `/appointments/new?client=${clientId}` : `/clients/${clientId}`);
}


export async function savePetPhotoAction(petId: string, form: FormData): Promise<{ error?: string }> {
  const staff = await requireStaff();
  const [pet] = await sql`select p.client_id from pets p join clients c on c.id = p.client_id
                          where p.id = ${petId} and c.business_id = ${staff.businessId}`;
  if (!pet) return { error: "Pet not found." };
  const file = form.get("photo");
  if (!(file instanceof Blob)) return { error: "Choose a photo." };
  const error = await savePetPhoto(petId, new Uint8Array(await file.arrayBuffer()));
  if (error) return { error };
  revalidatePath(`/clients/${pet.client_id}`);
  revalidatePath(`/clients/${pet.client_id}/pets/${petId}`);
  return {};
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

/** Marks a pet as passed away (or undoes it): hidden from booking, lists and reminders. */
export async function setPetPassedAction(clientId: string, petId: string, passed: boolean) {
  const staff = await requireStaff();
  await sql`update pets p set deceased_at = ${passed ? new Date() : null}
            from clients c where c.id = p.client_id and p.id = ${petId} and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteNoteAction(clientId: string, noteId: string) {
  const staff = await requireStaff();
  await sql`delete from client_notes n using clients c
            where n.id = ${noteId} and c.id = n.client_id and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}`);
}

export async function addVaccineAction(clientId: string, petId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const expires = String(form.get("expires_on") ?? "");
  const given = String(form.get("given_on") ?? "");
  if (!name) return { error: "Pick the vaccine." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { error: "Type when it expires (it's on the certificate)." };
  if (given && !/^\d{4}-\d{2}-\d{2}$/.test(given)) return { error: "Check the date it was given." };
  const [ok] = await sql`
    insert into vaccines (pet_id, name, given_on, expires_on)
    select p.id, ${name}, ${given || null}, ${expires} from pets p join clients c on c.id = p.client_id
    where p.id = ${petId} and c.business_id = ${staff.businessId}
    returning id`;
  if (!ok) return { error: "Pet not found." };
  revalidatePath(`/clients/${clientId}/pets/${petId}`);
  revalidatePath(`/clients/${clientId}`);
  return undefined;
}

export async function deleteVaccineAction(clientId: string, petId: string, vaccineId: string) {
  const staff = await requireStaff();
  await sql`delete from vaccines v using pets p, clients c
            where v.id = ${vaccineId} and p.id = v.pet_id and c.id = p.client_id and c.business_id = ${staff.businessId}`;
  revalidatePath(`/clients/${clientId}/pets/${petId}`);
  revalidatePath(`/clients/${clientId}`);
}

/**
 * Removes a client for good: their pets, visits, bills and payments, notes and signatures.
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
