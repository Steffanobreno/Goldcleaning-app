import "server-only";
import postgres from "postgres";
import { dbConfig } from "./db-config";

// One connection pool per server process. In dev, Next reloads modules, so the
// pool is kept on globalThis to avoid opening a new one on every change.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(dbConfig().url, {
    max: 5,
    // The free database sleeps after a few idle minutes; give it time to wake up.
    connect_timeout: 15,
    prepare: dbConfig().prepare,
    transform: { undefined: null },
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

// Postgres error codes we turn into friendly messages.
export function isExclusionViolation(e: unknown) {
  return (e as { code?: string })?.code === "23P01";
}
export function isUniqueViolation(e: unknown) {
  return (e as { code?: string })?.code === "23505";
}
