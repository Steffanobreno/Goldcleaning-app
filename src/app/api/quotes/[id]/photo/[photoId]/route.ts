import { getStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

// A photo sent with a quote request, for the owner's screens only.
export async function GET(_: Request, ctx: RouteContext<"/api/quotes/[id]/photo/[photoId]">) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const { id, photoId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(photoId)) return new Response("Not found", { status: 404 });
  const [photo] = await sql<{ content_type: string; data: Buffer }[]>`
    select p.content_type, p.data from quote_request_photos p join quote_requests q on q.id = p.quote_request_id
    where p.id = ${photoId} and q.id = ${id} and q.business_id = ${staff.businessId}`;
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.content_type, "Cache-Control": "private, max-age=86400" },
  });
}
