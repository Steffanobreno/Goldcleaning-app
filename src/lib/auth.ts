import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "wds_session";
const SESSION_DAYS = 60;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(key, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`insert into sessions (user_id, token_hash, expires_at)
            values (${userId}, ${hashToken(token)}, ${expires})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Too many wrong passwords for this email lately. */
export async function loginLocked(email: string) {
  const [r] = await sql`select count(*)::int as n from login_failures
                        where email = ${email.trim().toLowerCase()} and at > now() - interval '15 minutes'`;
  return r.n >= 8;
}

/** Returns true when the email and password match a user, and logs them in. */
export async function login(email: string, password: string) {
  const address = email.trim().toLowerCase();
  const [user] = await sql`select id, password_hash from users where email = ${address}`;
  // Hash anyway when the user does not exist so timing does not reveal valid emails.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : (await hashPassword(password), false);
  if (!ok) {
    await sql`insert into login_failures (email) values (${address})`;
    await sql`delete from login_failures where at < now() - interval '1 day'`;
    return false;
  }
  await sql`delete from login_failures where email = ${address}`;
  await startSession(user.id);
  return true;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  jar.delete(COOKIE);
}

/** First run only: creates the owner's login and links it to the owner staff row. */
export async function createOwner(email: string, password: string) {
  const [{ count }] = await sql`select count(*)::int as count from users`;
  if (count > 0) throw new Error("An owner account already exists.");
  const [user] = await sql`insert into users (email, password_hash)
    values (${email.trim().toLowerCase()}, ${await hashPassword(password)}) returning id`;
  await sql`update staff set user_id = ${user.id}
            where id = (select id from staff where role = 'owner' and user_id is null order by created_at limit 1)`;
  await startSession(user.id);
}

export async function hasAnyUser() {
  const [{ count }] = await sql`select count(*)::int as count from users`;
  return count > 0;
}

export type StaffContext = {
  staffId: string;
  staffName: string;
  businessId: string;
  businessName: string;
  businessPhone: string | null;
  timezone: string;
  bookingSlug: string;
};

/** The logged-in staff member, or null. Cached per request. */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await sql`
    select s.id as staff_id, s.name as staff_name, b.id as business_id, b.name as business_name,
           b.phone as business_phone, b.timezone, b.booking_slug
    from sessions se
    join staff s on s.user_id = se.user_id and s.active
    join businesses b on b.id = s.business_id
    where se.token_hash = ${hashToken(token)} and se.expires_at > now()`;
  if (!row) return null;
  return {
    staffId: row.staff_id,
    staffName: row.staff_name,
    businessId: row.business_id,
    businessName: row.business_name,
    businessPhone: row.business_phone,
    timezone: row.timezone,
    bookingSlug: row.booking_slug,
  };
});

/** Every owner page and action calls this first. All queries then filter by businessId. */
export async function requireStaff(): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return staff;
}
