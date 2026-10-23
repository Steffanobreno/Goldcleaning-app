import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";

// The groomers of the business (Settings → Team). Each visit belongs to one of them, so
// each has their own route on Today and their own color on the calendar.

export type Groomer = { id: string; name: string; role: string; color: string; phone: string | null; email: string | null; active: boolean };

export function listGroomers(staff: StaffContext, { activeOnly = false } = {}) {
  return sql<Groomer[]>`
    select id, name, role, color, phone, email, active from staff
    where business_id = ${staff.businessId} ${activeOnly ? sql`and active` : sql``}
    order by (role = 'owner') desc, active desc, created_at`;
}

/** The groomer id if it belongs to this business (and is active), else null. */
export async function ownGroomer(staff: StaffContext, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await sql`select id from staff where id = ${id} and business_id = ${staff.businessId} and active`;
  return row ? (row.id as string) : null;
}

/** The same context, acting for another groomer (their hours, their route, their blocks). */
export const asGroomer = (staff: StaffContext, staffId: string): StaffContext => ({ ...staff, staffId });

// Colors that read well as a bar and as a dot, distinct from the status colors.
export const GROOMER_COLORS = ["#1d6fb8", "#e8452c", "#1f9d55", "#8a4fd6", "#f59e0b", "#0ea5a4", "#db2777", "#5b4636"];
