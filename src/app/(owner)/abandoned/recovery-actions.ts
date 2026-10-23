"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Turns the "finish booking" message on or off (the same switch as in Texts and email). */
export async function setRecoveryAction(on: boolean) {
  const staff = await requireStaff();
  await sql`update message_templates set enabled = ${on} where business_id = ${staff.businessId} and trigger = 'abandoned_booking'`;
  revalidatePath("/abandoned");
  revalidatePath("/settings/messages");
}
