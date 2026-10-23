"use server";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";

export async function unsubscribeAction(token: string, subscribe: boolean) {
  if (!/^[0-9a-f]{24}$/.test(token)) redirect("/");
  await sql`update clients set email_unsubscribed_at = ${subscribe ? null : new Date()} where marketing_token = ${token}`;
  redirect(`/u/${token}${subscribe ? "?back=1" : "?done=1"}`);
}
