// Connection settings shared by the app and the scripts (no "server-only" so scripts can use it).
// Neon's pooled URL (host contains "-pooler") goes through PgBouncer in transaction mode,
// where prepared statements must be off. `channel_binding` is a libpq option the
// postgres.js driver doesn't know, so it's removed.
export function dbConfig(raw = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/woofers") {
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  return { url: url.toString(), prepare: !url.hostname.includes("-pooler") };
}
