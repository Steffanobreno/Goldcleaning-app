import "server-only";
import { sql } from "./db";

const MAX_BYTES = 1_500_000;

/** Detects the real image type from the first bytes; anything else is rejected. */
function sniff(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Saves (or replaces) a pet's photo. Returns an error message, or null when saved. */
export async function savePetPhoto(petId: string, bytes: Uint8Array) {
  if (bytes.length === 0) return "That photo is empty.";
  if (bytes.length > MAX_BYTES) return "That photo is too big.";
  const type = sniff(bytes);
  if (!type) return "Use a JPEG, PNG or WebP photo.";
  await sql`
    insert into pet_photos (pet_id, content_type, data) values (${petId}, ${type}, ${Buffer.from(bytes)})
    on conflict (pet_id) do update set content_type = excluded.content_type, data = excluded.data`;
  return null;
}

/** "data:image/jpeg;base64,..." from the booking page → bytes, or null. */
export function bytesFromDataUrl(dataUrl: string | null | undefined) {
  const m = String(dataUrl ?? "").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length > MAX_BYTES * 1.4) return null;
  return new Uint8Array(Buffer.from(m[2], "base64"));
}
