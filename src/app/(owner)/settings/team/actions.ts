"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { GROOMER_COLORS } from "@/lib/data/staff";

export type TeamState = { error?: string; saved?: boolean } | undefined;

function read(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const color = String(form.get("color") ?? "");
  const phoneRaw = String(form.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const email = String(form.get("email") ?? "").trim().toLowerCase() || null;
  if (!name) return { error: "Type the groomer's name." };
  if (!GROOMER_COLORS.includes(color)) return { error: "Pick a color." };
  if (phoneRaw && !phone) return { error: "Check the phone number (10 digits)." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Check the email address." };
  return { name, color, phone, email };
}

export async function addGroomerAction(_: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requireStaff();
  const g = read(form);
  if ("error" in g) return { error: g.error };
  await sql.begin(async (tx) => {
    const [row] = await tx`
      insert into staff (business_id, name, role, color, phone, email)
      values (${staff.businessId}, ${g.name}, 'groomer', ${g.color}, ${g.phone}, ${g.email}) returning id`;
    // Start with the owner's working hours; they can be changed later.
    await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
             select ${row.id}, weekday, start_time, end_time from working_hours where staff_id = ${staff.staffId}`;
  });
  revalidatePath("/settings/team");
  return { saved: true };
}

export async function updateGroomerAction(id: string, _: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requireStaff();
  const g = read(form);
  if ("error" in g) return { error: g.error };
  const [row] = await sql`select role from staff where id = ${id} and business_id = ${staff.businessId}`;
  if (!row) return { error: "Groomer not found." };
  const active = row.role === "owner" || form.get("active") === "on";
  await sql`update staff set name = ${g.name}, color = ${g.color}, phone = ${g.phone}, email = ${g.email}, active = ${active}
            where id = ${id} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/team");
  revalidatePath("/calendar");
  redirect("/settings/team");
}
