import "server-only";
import { zipInfo } from "./geo/zip";

// The service area is a list of city names. A ZIP is inside it when the city the ZIP data gives
// for it is on the list. Foster City, Hillsborough and Woodside have no ZIP of their own in that
// data (they show as San Mateo, Burlingame and Redwood City), which are on the list too.

export const UNKNOWN_ZIP = "We couldn't find that ZIP code. Please check it, or call or text us to book.";
export const OUTSIDE_AREA =
  "Sorry, that address is outside our service area. Call or text us and we'll see what we can do.";

/** Returns a message for the client, or null when the ZIP is inside the service area. */
export function serviceAreaProblem(zip: string, cities: string[]) {
  const info = zipInfo(zip);
  if (!info) return UNKNOWN_ZIP;
  const city = info.city.toLowerCase();
  return cities.some((c) => c.toLowerCase() === city) ? null : OUTSIDE_AREA;
}
