import "server-only";
import type { Sql, TransactionSql } from "postgres";
import { sql } from "../db";
import { discountCents, type DiscountDef } from "../pricing";

type Db = Sql | TransactionSql;

// Discounts and the standing price of a home. See db/migrations/0020_discounts.sql.

export type DiscountRow = {
  id: string; name: string; code: string | null; kind: "percent" | "amount"; percent: string | null; amount_cents: number | null;
  first_time_only: boolean; starts_on: string | null; ends_on: string | null; max_uses: number | null; uses: number; active: boolean;
};

export const toDef = (r: Pick<DiscountRow, "id" | "name" | "kind" | "percent" | "amount_cents">): DiscountDef => ({
  id: r.id, name: r.name, kind: r.kind, percent: r.percent == null ? null : Number(r.percent), amountCents: r.amount_cents,
});

export async function listDiscounts(businessId: string) {
  return sql<DiscountRow[]>`
    select id, name, code, kind, percent, amount_cents, first_time_only, starts_on::text, ends_on::text, max_uses, uses, active
    from discounts where business_id = ${businessId} order by active desc, (code is null), name`;
}

/** Discounts the owner can give to a single visit (any active one). */
export async function activeDiscounts(businessId: string, d0: Db = sql) {
  const db = d0 as Sql;
  const rows = await db<DiscountRow[]>`
    select id, name, code, kind, percent, amount_cents, first_time_only, starts_on::text, ends_on::text, max_uses, uses, active
    from discounts where business_id = ${businessId} and active order by (code is null) desc, name`;
  return rows.map(toDef);
}

/** What a home carries: its standing adjustment and its standing discounts (active ones). */
export async function homeStanding(homeId: string, d0: Db = sql) {
  const db = d0 as Sql;
  const [h] = await db<{ price_adjust_cents: number; price_adjust_note: string | null }[]>`
    select price_adjust_cents, price_adjust_note from homes where id = ${homeId}`;
  const rows = await db<DiscountRow[]>`
    select d.id, d.name, d.code, d.kind, d.percent, d.amount_cents, d.first_time_only, d.starts_on::text, d.ends_on::text,
           d.max_uses, d.uses, d.active
    from home_discounts hd join discounts d on d.id = hd.discount_id where hd.home_id = ${homeId} and d.active order by d.name`;
  return { adjustCents: h?.price_adjust_cents ?? 0, adjustNote: h?.price_adjust_note ?? null, discounts: rows.map(toDef) };
}

/**
 * The coupon a client typed on the booking page, or why it can't be used. `clientId` is null for
 * someone we don't know yet; a first-time coupon works only for a person with no earlier visit.
 */
export async function findCoupon(
  businessId: string, code: string, clientId: string | null, d0: Db = sql,
): Promise<{ coupon: DiscountDef } | { error: string }> {
  const db = d0 as Sql;
  const typed = code.trim();
  if (!typed) return { error: "Enter your code." };
  const [d] = await db<(DiscountRow & { today: string })[]>`
    select d.id, d.name, d.code, d.kind, d.percent, d.amount_cents, d.first_time_only, d.starts_on::text, d.ends_on::text,
           d.max_uses, d.uses, d.active, (now() at time zone b.timezone)::date::text as today
    from discounts d join businesses b on b.id = d.business_id
    where d.business_id = ${businessId} and d.code is not null and lower(d.code) = lower(${typed})`;
  const bad = { error: "That code isn't valid." };
  if (!d || !d.active) return bad;
  if (d.starts_on && d.today < d.starts_on) return { error: "That code isn't active yet." };
  if (d.ends_on && d.today > d.ends_on) return { error: "That code has expired." };
  if (d.max_uses != null && d.uses >= d.max_uses) return { error: "That code has been used up." };
  if (d.first_time_only && clientId) {
    const [prior] = await db`
      select 1 from appointments where client_id = ${clientId}
        and status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed') limit 1`;
    if (prior) return { error: "That code is for first-time clients only." };
  }
  return { coupon: toDef(d) };
}

/** Counts one use; false when the code was just used up. Call inside the booking transaction. */
export async function recordUse(d0: Db, discountId: string) {
  const db = d0 as Sql;
  const rows = await db`
    update discounts set uses = uses + 1 where id = ${discountId} and (max_uses is null or uses < max_uses) returning id`;
  return rows.length > 0;
}

/** Cents off for a coupon on this cleaning price (for the booking page's "you save"). */
export const savingFor = (coupon: DiscountDef, subtotalCents: number) => discountCents(coupon, subtotalCents);
