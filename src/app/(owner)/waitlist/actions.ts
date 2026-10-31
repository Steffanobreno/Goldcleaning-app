"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isYmd } from "@/lib/format";
import type { FormState } from "../settings/actions";

export async function addToWaitlistAction(clientId: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const from = String(form.get("from_date") ?? "");
  const to = String(form.get("to_date") ?? "") || from;
  const note = String(form.get("note") ?? "").trim().slice(0, 300) || null;
  if (!isYmd(from) || !isYmd(to)) return { error: "Pick the day (or the first and last day) they want." };
  if (to < from) return { error: "The last day comes before the first one." };
  const [c] = await sql`select id from clients where id = ${clientId} and business_id = ${staff.businessId}`;
  if (!c) return { error: "Client not found." };
  await sql`insert into waitlist (business_id, client_id, from_date, to_date, note)
            values (${staff.businessId}, ${clientId}, ${from}, ${to}, ${note})`;
  revalidatePath("/waitlist");
  redirect("/waitlist?added=1");
}

export async function removeFromWaitlistAction(id: string) {
  const staff = await requireStaff();
  await sql`update waitlist set status = 'removed' where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/waitlist");
  revalidatePath("/today");
}
