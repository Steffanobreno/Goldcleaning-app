import { getStaff } from "@/lib/auth";
import { sql } from "@/lib/db";

// The pet's photo, for the owner's screens only.
export async function GET(_: Request, ctx: RouteContext<"/api/pets/[id]/photo">) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [photo] = await sql<{ content_type: string; data: Buffer }[]>`
    select ph.content_type, ph.data from pet_photos ph
    join pets p on p.id = ph.pet_id join clients c on c.id = p.client_id
    where ph.pet_id = ${id} and c.business_id = ${staff.businessId}`;
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.content_type, "Cache-Control": "private, max-age=3600" },
  });
}
