import "server-only";
import { sql } from "../db";
import type { Catalog, CatalogService, Frequency, Rate } from "../pricing";

/** Active services with their rates, active extras and the visit-length rule, in display order. */
export async function loadCatalog(businessId: string, { onlineOnly = false } = {}): Promise<Catalog> {
  const [services, rates, extras, [biz]] = await Promise.all([
    sql<{ id: string; name: string; description: string | null; pricing: "rate" | "quote"; recurring: boolean }[]>`
      select id, name, description, pricing, recurring from services
      where business_id = ${businessId} and kind = 'service' and active and (${!onlineOnly} or online_bookable)
      order by sort_order, name`,
    sql<{ service_id: string; frequency: Frequency; start_cents: number; bedroom_cents: number; full_bath_cents: number; half_bath_cents: number }[]>`
      select r.service_id, r.frequency, r.start_cents, r.bedroom_cents, r.full_bath_cents, r.half_bath_cents
      from service_rates r join services s on s.id = r.service_id
      where s.business_id = ${businessId}`,
    sql<{ id: string; name: string; price_cents: number; per_unit: boolean; icon: string | null }[]>`
      select id, name, price_cents, per_unit, icon from services
      where business_id = ${businessId} and kind = 'extra' and active and (${!onlineOnly} or online_bookable)
      order by sort_order, name`,
    sql<{ base_duration_min: number; large_home_bedrooms: number; large_home_extra_min: number }[]>`
      select base_duration_min, large_home_bedrooms, large_home_extra_min from businesses where id = ${businessId}`,
  ]);
  const ratesOf = (serviceId: string) => {
    const out: Partial<Record<Frequency, Rate>> = {};
    for (const r of rates.filter((x) => x.service_id === serviceId)) {
      out[r.frequency] = {
        startCents: r.start_cents,
        bedroomCents: r.bedroom_cents,
        fullBathCents: r.full_bath_cents,
        halfBathCents: r.half_bath_cents,
      };
    }
    return out;
  };
  return {
    services: services.map<CatalogService>((s) => ({ ...s, rates: ratesOf(s.id) })),
    extras: extras.map((e) => ({ id: e.id, name: e.name, unitCents: e.price_cents, perUnit: e.per_unit, icon: e.icon })),
    rule: {
      baseMin: biz?.base_duration_min ?? 180,
      largeHomeBedrooms: biz?.large_home_bedrooms ?? 3,
      largeHomeExtraMin: biz?.large_home_extra_min ?? 60,
    },
  };
}
