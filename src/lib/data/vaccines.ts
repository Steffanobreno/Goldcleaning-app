import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { addDaysYmd, isUuid } from "../format";

// Pet vaccines and their alerts: a vaccine that has expired, or expires within SOON_DAYS
// of the visit, shows a warning on the visit, the route, the booking form and the pet.

export const VACCINE_NAMES = ["Rabies", "DHPP", "Bordetella", "Leptospirosis", "Canine influenza", "Lyme"];
export const SOON_DAYS = 30;

export type Vaccine = { id: string; pet_id: string; name: string; given_on: string | null; expires_on: string | null };
export type VaccineAlert = { pet_id: string; name: string; expires_on: string; expired: boolean };

export function listVaccines(staff: StaffContext, petId: string) {
  if (!isUuid(petId)) return Promise.resolve([] as Vaccine[]);
  return sql<Vaccine[]>`
    select v.id, v.pet_id, v.name, to_char(v.given_on, 'YYYY-MM-DD') as given_on, to_char(v.expires_on, 'YYYY-MM-DD') as expires_on
    from vaccines v join pets p on p.id = v.pet_id join clients c on c.id = p.client_id
    where v.pet_id = ${petId} and c.business_id = ${staff.businessId}
    order by v.expires_on desc nulls last, v.name`;
}

/**
 * Vaccines of these pets that are expired on `date` (yyyy-MM-dd) or expire within SOON_DAYS
 * after it. Only the newest record of each vaccine counts, so a renewed one clears the alert.
 */
export async function vaccineAlerts(staff: StaffContext, petIds: string[], date: string) {
  const ids = petIds.filter(isUuid);
  if (!ids.length) return [] as VaccineAlert[];
  return sql<VaccineAlert[]>`
    select v.pet_id, v.name, to_char(v.expires_on, 'YYYY-MM-DD') as expires_on, v.expires_on < ${date}::date as expired
    from (select distinct on (v.pet_id, lower(v.name)) v.* from vaccines v
          where v.pet_id = any(${ids}::uuid[]) and v.expires_on is not null
          order by v.pet_id, lower(v.name), v.expires_on desc) v
    join pets p on p.id = v.pet_id join clients c on c.id = p.client_id
    where c.business_id = ${staff.businessId} and v.expires_on <= ${addDaysYmd(date, SOON_DAYS)}::date
    order by v.expires_on`;
}

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

/** "Rabies expired Oct 2, 2026" / "Rabies expires Nov 3, 2026" */
export const alertText = (a: VaccineAlert) => `${a.name} ${a.expired ? "expired" : "expires"} ${fmt(a.expires_on)}`;
