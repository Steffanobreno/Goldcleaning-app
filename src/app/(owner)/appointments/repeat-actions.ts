"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isYmd } from "@/lib/format";
import { MAX_VISITS, type RepeatRule } from "@/lib/repeat";
import { bookSeries, replaceable } from "@/lib/data/series";

// The Repeat screen's actions. The booking itself is in src/lib/data/series.ts.

export type RepeatState = {
  error?: string;
  done?: { created: number; skipped: { date: string; reason: string }[]; stopped?: boolean };
} | undefined;

function readRule(form: FormData): RepeatRule | string {
  const freq = String(form.get("freq"));
  const every = Number(form.get("every"));
  const ends = String(form.get("ends"));
  const count = Number(form.get("count"));
  const until = String(form.get("until") ?? "");
  if (freq !== "day" && freq !== "week" && freq !== "month") return "Pick day, week or month.";
  if (!Number.isInteger(every) || every < 1 || every > 52) return "Repeat every 1 to 52.";
  if (ends === "count") {
    if (!Number.isInteger(count) || count < 2 || count > MAX_VISITS) return `Pick 2 to ${MAX_VISITS} times.`;
    return { freq, every, count, until: null };
  }
  if (!isYmd(until)) return "Pick the last day.";
  return { freq, every, count: null, until };
}

export async function saveRepeatAction(appointmentId: string, _: RepeatState, form: FormData): Promise<RepeatState> {
  const staff = await requireStaff();
  const rule = readRule(form);
  if (typeof rule === "string") return { error: rule };
  const r = await bookSeries(staff, appointmentId, rule);
  if ("error" in r) return r;
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath(`/appointments/${appointmentId}`);
  return { done: r };
}

/** Stops repeating: removes the later copies that are still just booked. */
export async function stopRepeatAction(appointmentId: string): Promise<RepeatState> {
  const staff = await requireStaff();
  const [a] = await sql<{ id: string; series_id: string | null; start_at: Date }[]>`
    select id, series_id, start_at from appointments where id = ${appointmentId} and business_id = ${staff.businessId}`;
  if (!a?.series_id) return { error: "This visit doesn't repeat." };
  const old = await replaceable(staff, a);
  await sql.begin(async (tx) => {
    if (old.length) await tx`delete from appointments where id = any(${old}::uuid[])`;
    await tx`update appointments set series_id = null, updated_at = now() where id = ${a.id}`;
  });
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath(`/appointments/${a.id}`);
  return { done: { created: 0, skipped: [], stopped: true } };
}
