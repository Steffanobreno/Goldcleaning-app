"use server";
import { redirect } from "next/navigation";
import { createOwner, hasAnyUser, login, loginLocked, logout } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (await loginLocked(email)) return { error: "Too many wrong tries. Wait 15 minutes and try again." };
  if (!(await login(email, password))) return { error: "That email and password don't match." };
  redirect("/today");
}

export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  if (await hasAnyUser()) redirect("/login");
  // Only someone holding SETUP_CODE (set on the server) can create the owner login,
  // so a stranger opening the new site first can't claim it.
  const code = process.env.SETUP_CODE;
  if (process.env.NODE_ENV === "production" && !code) return { error: "Setup is locked. Set SETUP_CODE on the server first." };
  if (code && form.get("setup_code") !== code) return { error: "That setup code is not right." };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 10) return { error: "Use at least 10 characters for the password." };
  if (password !== form.get("confirm")) return { error: "The two passwords are different." };
  await createOwner(email, password);
  redirect("/today");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
