"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { addDaysYmd, isYmd, zonedToUtc } from "@/lib/format";
import type { FormState } from "../appointments/actions";
import { ownGroomer } from "@/lib/data/staff";

const TIME = /^\d{2}:\d{2}$/;

/** Reads the block form: date, start, end (or all day) and the description. */
function readBlock(form: FormData, tz: string) {
  const date = String(form.get("date") ?? "");
  const allDay = form.get("all_day") === "on";
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200) || null;
  if (!isYmd(date)) return { error: "Pick a date." };
  if (!allDay && (!TIME.test(start) || !TIME.test(end))) return { error: "Pick a start and an end time." };
  if (!allDay && end <= start) return { error: "The end must be after the start." };
  return { date, allDay, start, end, reason, tz };
}

const range = (b: { date: string; allDay: boolean; start: string; end: string; tz: string }, date: string) =>
  b.allDay
    ? [zonedToUtc(date, "00:00", b.tz), zonedToUtc(addDaysYmd(date, 1), "00:00", b.tz)]
    : [zonedToUtc(date, b.start, b.tz), zonedToUtc(date, b.end, b.tz)];

export async function createBlockAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const b = readBlock(form, staff.timezone);
  if ("error" in b) return { error: b.error };

  // Repeat every 1 or 2 weeks until a date (at most a year of blocks).
  const every = Number(form.get("repeat"));
  const until = String(form.get("until") ?? "");
  const dates = [b.date];
  if (every === 1 || every === 2) {
    if (!isYmd(until) || until <= b.date) return { error: "Pick the last day the block repeats." };
    for (let d = addDaysYmd(b.date, 7 * every); d <= until && dates.length < 53; d = addDaysYmd(d, 7 * every)) dates.push(d);
  }
  const series = dates.length > 1 ? randomUUID() : null;
  const groomer = (await ownGroomer(staff, form.get("staff_id"))) ?? staff.staffId;
  await sql.begin(async (tx) => {
    for (const d of dates) {
      const [s, e] = range(b, d);
      await tx`insert into time_off (staff_id, start_at, end_at, reason, series_id)
               values (${groomer}, ${s}, ${e}, ${b.reason}, ${series})`;
    }
  });
  revalidatePath("/calendar");
  redirect(`/calendar?date=${b.date}`);
}

export async function updateBlockAction(id: string, _: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const b = readBlock(form, staff.timezone);
  if ("error" in b) return { error: b.error };
  const [s, e] = range(b, b.date);
  await sql`update time_off set start_at = ${s}, end_at = ${e}, reason = ${b.reason}, updated_at = now()
            where id = ${id} and staff_id in (select id from staff where business_id = ${staff.businessId})`;
  revalidatePath("/calendar");
  redirect(`/calendar?date=${b.date}`);
}

/** Removes one block, or (scope "following") this one and the later ones of its series. */
export async function deleteBlockAction(id: string, form: FormData) {
  const staff = await requireStaff();
  const [row] = await sql`select start_at, series_id from time_off where id = ${id} and staff_id in (select id from staff where business_id = ${staff.businessId})`;
  if (!row) redirect("/calendar");
  if (form.get("scope") === "following" && row.series_id) {
    await sql`delete from time_off where staff_id in (select id from staff where business_id = ${staff.businessId}) and series_id = ${row.series_id} and start_at >= ${row.start_at}`;
  } else {
    await sql`delete from time_off where id = ${id} and staff_id in (select id from staff where business_id = ${staff.businessId})`;
  }
  revalidatePath("/calendar");
  redirect(`/calendar?date=${String(form.get("date") ?? "")}`);
}
