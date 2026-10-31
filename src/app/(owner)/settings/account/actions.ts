"use server";
import { revalidatePath } from "next/cache";
import { accountEmail, changeEmail, changePassword, checkPin, logoutOthers, requireStaff, setPin } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { FormState } from "../actions";

export async function saveAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!name) return { error: "Enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  await sql`update staff set name = ${name} where id = ${staff.staffId}`;
  if (email.toLowerCase() !== (await accountEmail(staff.staffId)) && !(await changeEmail(staff.staffId, email)))
    return { error: "Another login already uses that email." };
  revalidatePath("/settings", "layout");
  return { saved: true };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (next.length < 10) return { error: "Use at least 10 characters for the new password." };
  if (next !== form.get("confirm")) return { error: "The two new passwords are different." };
  if (!(await changePassword(staff.staffId, current, next))) return { error: "Your current password is not right." };
  return { saved: true };
}

export async function logoutOthersAction() {
  const staff = await requireStaff();
  await logoutOthers(staff.staffId);
}

export async function savePinAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (form.get("remove") === "1") {
    await setPin(staff.staffId, null);
    revalidatePath("/", "layout");
    return { saved: true };
  }
  const pin = String(form.get("pin") ?? "");
  if (!/^\d{4,6}$/.test(pin)) return { error: "The PIN is 4 to 6 numbers." };
  if (pin !== form.get("pin_again")) return { error: "The two PINs are different." };
  await setPin(staff.staffId, pin);
  revalidatePath("/", "layout");
  return { saved: true };
}

/** The lock screen's check. */
export async function unlockAction(pin: string): Promise<"ok" | "wrong" | "logged-out"> {
  const staff = await requireStaff();
  return checkPin(staff.staffId, pin);
}
