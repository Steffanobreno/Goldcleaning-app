"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { SIZES } from "@/lib/format";
import { getDraft } from "@/lib/data/abandoned";

/** Hides an abandoned booking from the list (not interested, a test, a duplicate...). */
export async function deleteDraftAction(id: string) {
  const staff = await requireStaff();
  await sql`update booking_drafts set dismissed_at = now() where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/abandoned");
  revalidatePath("/requests");
  redirect("/abandoned");
}

/** Notes that the owner texted or called them from the app. */
export async function markContactedAction(id: string) {
  const staff = await requireStaff();
  await sql`update booking_drafts set contacted_at = now() where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/abandoned");
}

/** Makes a client (with their pets) from what they typed, then opens the booking form. */
export async function addClientFromDraftAction(id: string) {
  const staff = await requireStaff();
  const d = await getDraft(staff, id);
  if (!d) redirect("/abandoned");
  const [existing] = await sql`select id from clients where business_id = ${staff.businessId} and phone = ${d.phone}`;
  if (existing) redirect(`/appointments/new?client=${existing.id}`);
  const sizes = SIZES.map((x) => x.value as string);
  const clientId = await sql.begin(async (tx) => {
    const [c] = await tx`
      insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip, source)
      values (${staff.businessId}, ${d.first_name ?? "New client"}, ${d.last_name ?? ""}, ${d.phone}, ${d.email},
              ${d.address_line}, ${d.city}, 'CA', ${d.zip}, 'online')
      returning id`;
    for (const p of d.pet_details ?? []) {
      if (!p.name) continue;
      await tx`insert into pets (client_id, name, breed, size_class)
               values (${c.id}, ${p.name}, ${p.breed || null}, ${sizes.includes(p.size) ? p.size : null})`;
    }
    await tx`update booking_drafts set client_id = ${c.id}, contacted_at = coalesce(contacted_at, now()) where id = ${id}`;
    return c.id as string;
  });
  revalidatePath("/clients");
  redirect(`/appointments/new?client=${clientId}`);
}
