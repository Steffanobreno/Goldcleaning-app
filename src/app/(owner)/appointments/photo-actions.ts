"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

// Photos of a cleaning (before, after, other), shrunk in the browser and sent as data URLs.

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PER_VISIT = 24;

export async function addVisitPhotosAction(appointmentId: string, kind: string, photos: string[]): Promise<{ error?: string; added?: number }> {
  const staff = await requireStaff();
  const [a] = await sql`
    select a.id, (select ah.home_id from appointment_homes ah where ah.appointment_id = a.id order by ah.created_at limit 1) as home_id
    from appointments a where a.id = ${appointmentId} and a.business_id = ${staff.businessId}`;
  if (!a) return { error: "Appointment not found." };
  const k = ["before", "after", "other"].includes(kind) ? kind : "other";
  const rows = (Array.isArray(photos) ? photos : []).slice(0, 8).flatMap((url) => {
    const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(url));
    if (!m || !TYPES.includes(m[1])) return [];
    const data = Buffer.from(m[2], "base64");
    return data.length > 0 && data.length <= 1_500_000 ? [{ content_type: m[1], data }] : [];
  });
  if (rows.length === 0) return { error: "That photo could not be saved. Try another one." };
  const [{ n }] = await sql`select count(*)::int as n from visit_photos where appointment_id = ${appointmentId}`;
  if (n + rows.length > MAX_PER_VISIT) return { error: `A cleaning can keep up to ${MAX_PER_VISIT} photos.` };
  await sql.begin(async (tx) => {
    for (const r of rows) {
      await tx`insert into visit_photos (appointment_id, home_id, kind, content_type, data)
               values (${appointmentId}, ${a.home_id}, ${k}, ${r.content_type}, ${r.data})`;
    }
  });
  revalidatePath(`/appointments/${appointmentId}`);
  return { added: rows.length };
}

export async function deleteVisitPhotoAction(appointmentId: string, photoId: string) {
  const staff = await requireStaff();
  await sql`delete from visit_photos p using appointments a
            where p.id = ${photoId} and p.appointment_id = ${appointmentId} and a.id = p.appointment_id and a.business_id = ${staff.businessId}`;
  revalidatePath(`/appointments/${appointmentId}`);
}
