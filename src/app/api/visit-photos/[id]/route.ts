import { getStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

// A cleaning photo, for the team only.
export async function GET(_: Request, { params }: RouteContext<"/api/visit-photos/[id]">) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [p] = await sql<{ content_type: string; data: Buffer }[]>`
    select p.content_type, p.data from visit_photos p join appointments a on a.id = p.appointment_id
    where p.id = ${id} and a.business_id = ${staff.businessId}`;
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.data), { headers: { "Content-Type": p.content_type, "Cache-Control": "private, max-age=86400" } });
}
