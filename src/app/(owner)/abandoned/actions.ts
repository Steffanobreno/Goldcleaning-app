"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getDraft } from "@/lib/data/abandoned";
import { emailAbandonedNow } from "@/lib/messaging";

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

/** Sends the "finish booking" email now. Returns what happened, for the button. */
export async function emailDraftAction(id: string) {
  const staff = await requireStaff();
  const result = await emailAbandonedNow(staff.businessId, id);
  revalidatePath("/abandoned");
  revalidatePath(`/abandoned/${id}`);
  return result;
}

/** Makes a client (with their home) from what they typed, then opens the booking form. */
export async function addClientFromDraftAction(id: string) {
  const staff = await requireStaff();
  const d = await getDraft(staff, id);
  if (!d) redirect("/abandoned");
  const [existing] = await sql`select id from clients where business_id = ${staff.businessId} and phone = ${d.phone}`;
  if (existing) redirect(`/appointments/new?client=${existing.id}`);
  const clientId = await sql.begin(async (tx) => {
    const [c] = await tx`
      insert into clients (business_id, first_name, last_name, phone, email, address_line, city, state, zip, source)
      values (${staff.businessId}, ${d.first_name ?? "New client"}, ${d.last_name ?? ""}, ${d.phone}, ${d.email},
              ${d.address_line}, ${d.city}, 'CA', ${d.zip}, 'online')
      returning id`;
    const h = d.details;
    const clamp = (n: unknown, min: number, max: number, dflt: number) =>
      Number.isInteger(n) && (n as number) >= min && (n as number) <= max ? (n as number) : dflt;
    await tx`insert into homes (client_id, address_line, city, state, zip, bedrooms, full_baths, half_baths)
             values (${c.id}, ${d.address_line}, ${d.city}, 'CA', ${d.zip}, ${clamp(h?.bedrooms, 0, 7, 1)},
                     ${clamp(h?.fullBaths, 1, 7, 1)}, ${clamp(h?.halfBaths, 0, 7, 0)})`;
    await tx`update booking_drafts set client_id = ${c.id}, contacted_at = coalesce(contacted_at, now()) where id = ${id}`;
    return c.id as string;
  });
  revalidatePath("/clients");
  redirect(`/appointments/new?client=${clientId}`);
}
