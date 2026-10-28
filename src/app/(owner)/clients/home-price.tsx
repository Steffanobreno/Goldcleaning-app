import { sql } from "@/lib/db";
import { discountLabel, type DiscountDef } from "@/lib/pricing";
import { toDef, type DiscountRow } from "@/lib/data/discounts";
import { Card, Field, Input } from "@/components/ui";
import { SimpleForm } from "../settings/forms";
import { saveHomePriceAction } from "./actions";

/** "Price for this home": a standing adjustment and standing discounts, used for every visit booked here. */
export async function HomePrice({ businessId, clientId, homeId }: { businessId: string; clientId: string; homeId: string }) {
  const [[home], all, mine] = await Promise.all([
    sql<{ price_adjust_cents: number; price_adjust_note: string | null }[]>`select price_adjust_cents, price_adjust_note from homes where id = ${homeId}`,
    sql<DiscountRow[]>`
      select id, name, code, kind, percent, amount_cents, first_time_only, starts_on::text, ends_on::text, max_uses, uses, active
      from discounts where business_id = ${businessId} and active and code is null order by name`,
    sql<{ discount_id: string }[]>`select discount_id from home_discounts where home_id = ${homeId}`,
  ]);
  const on = new Set(mine.map((m) => m.discount_id));
  const defs: DiscountDef[] = all.map(toDef);
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">Price for this home</h2>
      <p className="text-sm text-muted">
        For a client who pays a little more or less than the price list. It is added to every visit booked for this home,
        including repeating ones. Visits already booked keep their price.
      </p>
      <SimpleForm action={saveHomePriceAction.bind(null, clientId, homeId)} submitLabel="Save price" savedLabel="Price saved.">
        <Field label="Adjustment per visit ($)" hint="A negative amount lowers the price, like -20. A positive one raises it. Empty means the price list.">
          <Input name="adjustment" inputMode="decimal" defaultValue={home?.price_adjust_cents ? (home.price_adjust_cents / 100).toFixed(2) : ""} placeholder="0.00" />
        </Field>
        <Field label="Label on the bill (optional)" hint="Shown to the client, like “Loyalty rate”. Empty shows “Regular client rate”.">
          <Input name="note" defaultValue={home?.price_adjust_note ?? ""} maxLength={80} />
        </Field>
        {defs.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Discounts that always apply</legend>
            {defs.map((d) => (
              <label key={d.id} className="flex items-center gap-3 text-sm">
                <input type="checkbox" name={`d:${d.id}`} defaultChecked={on.has(d.id)} className="h-5 w-5" />
                {discountLabel(d)}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-sm text-muted">Create discounts in Settings → Discounts to apply them here.</p>
        )}
      </SimpleForm>
    </Card>
  );
}
