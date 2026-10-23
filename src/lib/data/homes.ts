import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { isUuid } from "../format";

export { ACCESS_METHODS, accessLabel, homeSizeLabel, type AccessMethod } from "../home-options";
import type { AccessMethod } from "../home-options";

export type HomeRow = {
  id: string;
  client_id: string;
  label: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  bedrooms: number;
  full_baths: number;
  half_baths: number;
  access_method: AccessMethod | null;
  access_code: string | null;
  parking_notes: string | null;
  pets_in_home: string | null;
  product_preferences: string | null;
  notes: string | null;
  archived_at: Date | null;
};

export async function listHomes(staff: StaffContext, clientId: string) {
  return sql<HomeRow[]>`
    select h.* from homes h join clients c on c.id = h.client_id
    where h.client_id = ${clientId} and c.business_id = ${staff.businessId} and h.archived_at is null
    order by h.created_at`;
}

export async function getHome(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [home] = await sql<HomeRow[]>`
    select h.* from homes h join clients c on c.id = h.client_id
    where h.id = ${id} and c.business_id = ${staff.businessId}`;
  return home ?? null;
}

export type HomeInput = Omit<HomeRow, "id" | "client_id" | "lat" | "lng" | "archived_at"> & { lat?: number | null; lng?: number | null };

/** Creates or updates a home of a client of this business. Returns its id, or null when not allowed. */
export async function upsertHome(staff: StaffContext, clientId: string, input: HomeInput, id?: string) {
  const [client] = await sql`select id from clients where id = ${clientId} and business_id = ${staff.businessId}`;
  if (!client) return null;
  const v = {
    label: input.label || "Home",
    address_line: input.address_line,
    city: input.city,
    state: input.state ?? "CA",
    zip: input.zip,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    bedrooms: input.bedrooms,
    full_baths: input.full_baths,
    half_baths: input.half_baths,
    access_method: input.access_method,
    access_code: input.access_code,
    parking_notes: input.parking_notes,
    pets_in_home: input.pets_in_home,
    product_preferences: input.product_preferences,
    notes: input.notes,
  };
  if (id) {
    const [row] = await sql`
      update homes set ${sql(v)} where id = ${id} and client_id = ${clientId} returning id`;
    return (row?.id as string) ?? null;
  }
  const [row] = await sql`insert into homes ${sql({ ...v, client_id: clientId })} returning id`;
  return row.id as string;
}
