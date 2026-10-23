import "server-only";
import zips from "./ca-zips.json";

// California ZIP centroids (see ZIPS-LICENSE.txt). Distances are straight-line miles
// between ZIP centers: simple, free and good enough to keep a day's stops close together.

type Entry = [lat: number, lng: number, city: string];
const table = zips as unknown as Record<string, Entry>;

export function zipInfo(zip: string | null | undefined) {
  const key = (zip ?? "").trim().slice(0, 5);
  const e = table[key];
  return e ? { zip: key, lat: e[0], lng: e[1], city: e[2] } : null;
}

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Miles between two ZIP codes, or null when either is unknown. */
export function zipMiles(a: string | null | undefined, b: string | null | undefined) {
  const za = zipInfo(a);
  const zb = zipInfo(b);
  return za && zb ? milesBetween(za, zb) : null;
}
