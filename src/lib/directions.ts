// Links that open the Google Maps app (or website) with directions.
// Uses the documented "Maps URLs" format, which needs no API key.

type Stop = { address: string | null; lat?: number | null; lng?: number | null };

const where = (s: Stop) => (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : (s.address ?? ""));

export function directionsUrl(stop: Stop) {
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("destination", where(stop));
  u.searchParams.set("travelmode", "driving");
  return u.toString();
}

/** The whole day as one route: every stop in order. Google Maps allows up to 9 waypoints. */
export function routeUrl(stops: Stop[], origin?: Stop | null) {
  const valid = stops.filter((s) => where(s));
  if (valid.length === 0) return null;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  if (origin && where(origin)) u.searchParams.set("origin", where(origin));
  const last = valid[valid.length - 1];
  u.searchParams.set("destination", where(last));
  const middle = valid.slice(0, -1).slice(0, 9);
  if (middle.length) u.searchParams.set("waypoints", middle.map(where).join("|"));
  u.searchParams.set("travelmode", "driving");
  return u.toString();
}
