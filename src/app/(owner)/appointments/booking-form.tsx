"use client";
import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { minutesLabel, money } from "@/lib/format";
import { homeSizeLabel } from "@/lib/home-options";
import { agreedQuote, discountLabel, FREQUENCIES, FREQUENCY_LABEL, quote, totalCents, withDiscounts, type Catalog, type DiscountDef, type Frequency } from "@/lib/pricing";
import type { FormState } from "./actions";

type Home = { id: string; label: string; bedrooms: number; full_baths: number; half_baths: number; address: string };
/** Editing the price of a booked visit: its home is fixed and there is no date to pick. */
export type EditValues = {
  serviceId: string;
  frequency: Frequency;
  qty: Record<string, number>;
  adjustCents: number;
  durationMin: number;
  baseMin: number;
  agreedCents: number | null; // a quote-only service: the price agreed by hand
  couponId: string | null; // the discount given to this visit only
};

/** What a home carries: its standing adjustment and discounts, applied to every visit booked for it. */
export type Standing = { adjustCents: number; note: string | null; discounts: DiscountDef[] };

export function BookingForm({
  action,
  homes,
  catalog,
  defaultHome,
  defaultDate,
  defaultTime,
  slotTimes,
  edit,
  standing = {},
  discounts = [],
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  homes: Home[];
  catalog: Catalog;
  defaultHome?: string;
  defaultDate: string;
  defaultTime: string;
  slotTimes: { time: string; label: string }[]; // quick picks: the online slots
  edit?: EditValues;
  standing?: Record<string, Standing>;
  discounts?: DiscountDef[]; // the discounts that can be given to one visit
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Quote-only services (Airbnb, office) are booked at the price agreed with the client.
  const services = catalog.services;
  const [homeId, setHomeId] = useState(defaultHome && homes.some((h) => h.id === defaultHome) ? defaultHome : homes[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(edit?.serviceId ?? services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);
  const agreed = service?.pricing === "quote";
  const offered = agreed ? FREQUENCIES : FREQUENCIES.filter((f) => service?.rates[f]);
  const [agreedPrice, setAgreedPrice] = useState(edit?.agreedCents ? (edit.agreedCents / 100).toFixed(2) : "");
  const [frequency, setFrequency] = useState<Frequency>(edit?.frequency ?? "one_time");
  const freq = offered.includes(frequency) ? frequency : (offered[0] ?? "one_time");
  const [qty, setQty] = useState<Record<string, number>>(edit?.qty ?? {});
  const [time, setTime] = useState(defaultTime);
  const [extraMin, setExtraMin] = useState(edit ? edit.durationMin - edit.baseMin : 0); // the owner's change to the estimate
  const [adjust, setAdjust] = useState(edit?.adjustCents ? (edit.adjustCents / 100).toFixed(2) : "");
  const [couponId, setCouponId] = useState(edit?.couponId ?? "");

  const home = homes.find((h) => h.id === homeId);
  const size = home ? { bedrooms: home.bedrooms, fullBaths: home.full_baths, halfBaths: home.half_baths } : null;
  const q = !size
    ? null
    : agreed
      ? agreedQuote(catalog, { serviceId, frequency: freq, home: size }, Math.round((Number(agreedPrice.replace(/[$,\s]/g, "")) || 0) * 100))
      : quote(catalog, {
          serviceId,
          frequency: freq,
          home: size,
          extras: Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ serviceId: id, qty: n })),
        });
  const priced = q && !("error" in q) ? q : null;
  const adjustCents = Math.round((Number(adjust.replace(/[$,\s]/g, "")) || 0) * 100);
  // The home's standing price and the visit's discount are added to the cleaning's lines (not for an agreed price).
  const stand = !agreed ? standing[homeId] : undefined;
  const coupon = discounts.find((d) => d.id === couponId) ?? null;
  const lines = priced ? withDiscounts(priced.lines, { adjustCents: stand?.adjustCents, adjustNote: stand?.note, standing: stand?.discounts, coupon }) : [];
  const total = totalCents(lines) + adjustCents;
  const visitMin = Math.max((priced?.durationMin ?? 0) + extraMin, 30);

  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}

      {edit ? (
        <input type="hidden" name="home" value={homeId} />
      ) : (
      <>
      <h2 className="section-label">Home</h2>
      <div className="space-y-2">
        {homes.map((h) => (
          <label key={h.id} className="card flex cursor-pointer items-center gap-3 px-4 py-3 has-[:checked]:border-2 has-[:checked]:border-brand">
            <input type="radio" name="home" value={h.id} checked={h.id === homeId} onChange={() => setHomeId(h.id)} className="h-5 w-5 accent-[var(--color-brand)]" />
            <span className="min-w-0">
              <span className="block font-semibold">{h.label} · {homeSizeLabel(h)}</span>
              <span className="block truncate text-sm text-muted">{h.address || "No address"}</span>
            </span>
          </label>
        ))}
      </div>
      </>
      )}

      <h2 className="section-label pt-2">Service</h2>
      <div className="card space-y-3 px-4 py-4">
        <Field label="Service">
          <Select name="service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.pricing === "quote" ? " (agreed price)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {offered.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">How often</legend>
            <div className="grid grid-cols-2 gap-2">
              {offered.map((f) => (
                <label key={f} className="flex cursor-pointer items-center justify-center rounded-xl border border-line px-3 py-2 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="radio" name="frequency" value={f} checked={f === freq} onChange={() => setFrequency(f)} className="sr-only" />
                  {FREQUENCY_LABEL[f]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {offered.length <= 1 && <input type="hidden" name="frequency" value={freq} />}
        {agreed && (
          <Field label="Agreed price ($)" hint="The price you quoted the client for each visit.">
            <Input name="agreed_price" inputMode="decimal" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} placeholder="180.00" required />
          </Field>
        )}
      </div>

      {!agreed && catalog.extras.length > 0 && (
        <details className="card px-4 py-3" open={Object.values(qty).some((n) => n > 0)}>
          <summary className="cursor-pointer font-semibold text-brand">
            Extras{Object.values(qty).filter((n) => n > 0).length ? ` (${Object.values(qty).filter((n) => n > 0).length})` : ""}
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {catalog.extras.map((x) => {
              const n = qty[x.id] ?? 0;
              return (
                <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1">
                    {x.name}
                    <span className="block text-xs text-muted">{money(x.unitCents)}{x.perUnit ? " each" : ""}</span>
                  </span>
                  {x.perUnit ? (
                    <span className="flex items-center gap-2">
                      <button type="button" className="stepper" aria-label={`Fewer ${x.name}`} onClick={() => setQty({ ...qty, [x.id]: Math.max(n - 1, 0) })}>−</button>
                      <span className="w-6 text-center font-semibold tabular-nums">{n}</span>
                      <button type="button" className="stepper" aria-label={`More ${x.name}`} onClick={() => setQty({ ...qty, [x.id]: Math.min(n + 1, 20) })}>+</button>
                    </span>
                  ) : (
                    <input type="checkbox" aria-label={x.name} checked={n > 0} onChange={(e) => setQty({ ...qty, [x.id]: e.target.checked ? 1 : 0 })} className="h-5 w-5 accent-[var(--color-brand)]" />
                  )}
                  {n > 0 && <input type="hidden" name={`x:${x.id}`} value={n} />}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <h2 className="section-label pt-2">{edit ? "Length" : "When"}</h2>
      <div className="card divide-y divide-line">
        {!edit && (
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <Field label="Date">
            <Input type="date" name="date" defaultValue={defaultDate} required />
          </Field>
          <Field label="Start time">
            <Input type="time" name="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} required />
          </Field>
          {slotTimes.length > 0 && (
            <div className="col-span-2 flex gap-2">
              {slotTimes.map((s) => (
                <button key={s.time} type="button" onClick={() => setTime(s.time)}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${time === s.time ? "border-brand bg-brand-soft" : "border-line"}`}>
                  {s.label} {s.time}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block font-medium">Time estimate</span>
            <span className="block text-xs text-muted">From the home size{extraMin ? `, ${extraMin > 0 ? "+" : ""}${extraMin} min` : ""}</span>
          </span>
          <span className="flex items-center gap-3">
            <button type="button" className="stepper" aria-label="Less time" onClick={() => setExtraMin(extraMin - 30)}>−</button>
            <span className="w-16 text-center font-semibold tabular-nums" aria-live="polite">{priced ? minutesLabel(visitMin) : "—"}</span>
            <button type="button" className="stepper" aria-label="More time" onClick={() => setExtraMin(extraMin + 30)}>+</button>
          </span>
          <input type="hidden" name="duration" value={priced ? visitMin : ""} />
        </div>
      </div>

      {discounts.length > 0 && (
        <Field label="Discount for this visit only (optional)" hint="Set up discounts in Settings → Discounts.">
          <Select name="discount" value={couponId} onChange={(e) => setCouponId(e.target.value)}>
            <option value="">No discount</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>{discountLabel(d)}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Price adjustment ($, optional)" hint="Only for this visit. A negative amount is a discount, like -20. For a home that always pays a different price, set it on the home.">
        <Input name="adjustment" inputMode="decimal" value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="0.00" />
      </Field>
      {!edit && (
        <Field label="Notes for this cleaning (optional)">
          <Textarea name="notes" placeholder="Private notes for this visit" />
        </Field>
      )}

      <div className="card divide-y divide-line">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between px-4 py-2 text-sm">
            <span>{l.label}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
            <span className="tabular-nums">{money(l.amountCents)}</span>
          </div>
        ))}
        {adjustCents !== 0 && (
          <div className="flex justify-between px-4 py-2 text-sm">
            <span>Adjustment</span>
            <span className="tabular-nums">{money(adjustCents)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-muted">{q && "error" in q ? q.error : "Total"}</span>
          <span className="text-xl font-bold" data-testid="total">{money(total)}</span>
        </div>
      </div>

      {!edit && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-[var(--color-brand)]" />
          Email the confirmation to the client
        </label>
      )}

      {state?.warning && (
        <div className="space-y-2">
          <Notice kind="warn">{state.warning}</Notice>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="override" className="h-5 w-5" />
            Book anyway
          </label>
        </div>
      )}

      <Button type="submit" className="w-full rounded-2xl py-3.5 text-base" disabled={pending || !priced}>
        {pending ? "Saving…" : edit ? "Save" : "Book cleaning"}
      </Button>
    </ActionForm>
  );
}
