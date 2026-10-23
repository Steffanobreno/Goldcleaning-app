import "server-only";
import { sql } from "./db";

/** The business that owns this secret device key (iPhone Shortcut, calendar feed), or null. */
export async function businessForDeviceKey(key: string | null) {
  if (!key || key.length < 32) return null;
  const [b] = await sql<{ id: string; name: string; timezone: string }[]>`
    select id, name, timezone from businesses where device_key = ${key}`;
  return b ?? null;
}
