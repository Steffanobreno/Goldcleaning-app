import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";

export type ServiceRow = {
  id: string;
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  description: string | null;
  duration_min: number;
  price_cents: number;
  online_bookable: boolean;
  sort_order: number;
  active: boolean;
};

export async function listServices(staff: StaffContext, { includeInactive = false } = {}) {
  return sql<ServiceRow[]>`
    select id, name, kind, category, size_class, description, duration_min, price_cents,
           online_bookable, sort_order, active
    from services
    where business_id = ${staff.businessId} and (${includeInactive} or active)
    order by kind, sort_order, name`;
}

export async function getService(staff: StaffContext, id: string) {
  const [row] = await sql<ServiceRow[]>`
    select * from services where id = ${id} and business_id = ${staff.businessId}`;
  return row ?? null;
}

/** Groups by category, keeping the configured order. */
export function groupByCategory(services: ServiceRow[]) {
  const groups = new Map<string, ServiceRow[]>();
  for (const s of services) {
    const key = s.category || (s.kind === "addon" ? "Add-on" : "Services");
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()];
}
