import "server-only";
import { sql } from "./db";

// Street address → map point, with the US Census Bureau geocoder: free, no key, US addresses.
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const u = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  u.searchParams.set("address", address);
  u.searchParams.set("benchmark", "Public_AR_Current");
  u.searchParams.set("format", "json");
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.result?.addressMatches?.[0]?.coordinates;
    return typeof c?.x === "number" && typeof c?.y === "number" ? { lat: c.y, lng: c.x } : null;
  } catch {
    return null;
  }
}

type Stop = { id: string; client_id: string; address_line: string | null; zip: string | null; lat: number | null; lng: number | null };

/**
 * Fills in the map points of the visits that don't have one yet (and their client's, when
 * missing), trying each address once. Changes the stops in place.
 */
export async function locateStops(stops: Stop[]) {
  const missing = stops.filter((s) => s.lat == null && s.address_line).slice(0, 15);
  if (missing.length === 0) return;
  const tried = await sql<{ id: string }[]>`
    select id from appointments where id = any(${missing.map((s) => s.id)}) and geocode_tried_at is null`;
  const todo = missing.filter((s) => tried.some((t) => t.id === s.id));
  await Promise.all(todo.map(async (s) => {
    const point = await geocode([s.address_line, s.zip].filter(Boolean).join(" "));
    await sql`update appointments set geocode_tried_at = now(), lat = ${point?.lat ?? null}, lng = ${point?.lng ?? null}
              where id = ${s.id}`;
    if (!point) return;
    await sql`update clients set lat = ${point.lat}, lng = ${point.lng} where id = ${s.client_id} and lat is null
              and ${s.address_line} like address_line || '%'`; // only when the visit is at the client's address
    s.lat = point.lat;
    s.lng = point.lng;
  }));
}
