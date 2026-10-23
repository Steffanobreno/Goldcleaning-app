import "server-only";

// Google Maps Platform, used only from the server with the owner's own key.
// Everything here degrades gracefully when GOOGLE_MAPS_API_KEY is not set.

export type Geo = { lat: number; lng: number; zip: string | null; city: string | null };

export async function geocode(address: string): Promise<Geo | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !address.trim()) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;
    const part = (type: string) =>
      r.address_components?.find((c: { types: string[] }) => c.types.includes(type))?.long_name ?? null;
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, zip: part("postal_code"), city: part("locality") };
  } catch {
    return null;
  }
}
