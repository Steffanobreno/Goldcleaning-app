"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export type ServiceValues = {
  name: string;
  kind: "service" | "extra";
  category: string | null;
  per_unit: boolean;
  pricing: "rate" | "quote";
  recurring: boolean;
  icon: string | null;
  duration_min: number;
  price_cents: number;
  description: string | null;
  active: boolean;
  online_bookable: boolean;
};

const ICONS = ["cabinet", "garage", "garage-floor", "oven", "fridge", "baseboard", "patio", "door", "window", "linens", "dishes", "blinds"];

/**
 * A cleaning (its prices per frequency are set on the Price list) or an extra (one price, per
 * unit or not). Quote-only cleanings (Airbnb, office) have no online price.
 */
export function ServiceForm({ action, initial, categories }: { action: Action; initial?: ServiceValues; categories: string[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [kind, setKind] = useState(initial?.kind ?? "service");
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <Field label="Name">
        <Input name="name" defaultValue={initial?.name} required />
      </Field>
      <Field label="Type">
        <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "service" | "extra")}>
          <option value="service">Cleaning</option>
          <option value="extra">Extra</option>
        </Select>
      </Field>
      {kind === "service" ? (
        <>
          <Field label="Price">
            <Select name="pricing" defaultValue={initial?.pricing ?? "rate"}>
              <option value="rate">From the price list (bedrooms and bathrooms)</option>
              <option value="quote">By quote (no price online)</option>
            </Select>
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="recurring" defaultChecked={initial?.recurring ?? false} className="h-4 w-4" />
            Can repeat (weekly, every 2 weeks, every 4 weeks)
          </label>
          <input type="hidden" name="price" value="0" />
          <input type="hidden" name="duration_min" value="0" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price ($)">
              <Input name="price" inputMode="decimal" defaultValue={initial ? (initial.price_cents / 100).toFixed(2) : ""} required />
            </Field>
            <Field label="Icon">
              <Select name="icon" defaultValue={initial?.icon ?? ""}>
                <option value="">✨ Sparkle</option>
                {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="per_unit" defaultChecked={initial?.per_unit ?? false} className="h-4 w-4" />
            Charged per unit (the client picks how many)
          </label>
          <input type="hidden" name="duration_min" value="0" />
          <input type="hidden" name="category" value={initial?.category ?? "Extras"} />
        </>
      )}
      {kind === "service" && (
        <datalist id="categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      )}
      <Field label="Description (optional)">
        <Textarea name="description" defaultValue={initial?.description ?? ""} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4" />
        Active (shows up when booking)
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="online_bookable" defaultChecked={initial?.online_bookable ?? true} className="h-4 w-4" />
        Clients can book it online
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </ActionForm>
  );
}


/** A settings form whose fields are passed as children; shows "Saved" or the error. */
export function HoursForm({ action, hours }: { action: Action; hours: { weekday: number; start: string; end: string }[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  // Monday first.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ActionForm action={formAction} className="space-y-3">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && <Notice kind="success">Working hours saved.</Notice>}
      {order.map((d) => {
        const h = byDay.get(d);
        return (
          <div key={d} className="grid grid-cols-[7.5rem_1fr_1fr] items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name={`open:${d}`} defaultChecked={!!h} className="h-4 w-4" />
              {WEEKDAYS[d]}
            </label>
            <label>
              <span className="sr-only">{WEEKDAYS[d]} start</span>
              <Input type="time" name={`start:${d}`} defaultValue={h?.start ?? "07:00"} step={900} />
            </label>
            <label>
              <span className="sr-only">{WEEKDAYS[d]} end</span>
              <Input type="time" name={`end:${d}`} defaultValue={h?.end ?? "19:00"} step={900} />
            </label>
          </div>
        );
      })}
      <p className="text-xs text-muted">Unchecked days are days off.</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save hours"}
      </Button>
    </ActionForm>
  );
}

export function BusinessForm({
  action,
  initial,
}: {
  action: Action;
  initial: { name: string; phone: string; booking_slug: string; owner_name: string };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && <Notice kind="success">Saved.</Notice>}
      <Field label="Business name">
        <Input name="name" defaultValue={initial.name} required />
      </Field>
      <Field label="Your name">
        <Input name="owner_name" defaultValue={initial.owner_name} />
      </Field>
      <Field label="Business phone" hint="Shown in texts to clients.">
        <Input name="phone" type="tel" defaultValue={initial.phone} />
      </Field>
      <Field label="Booking link" hint="Used for the online booking page later.">
        <Input name="booking_slug" defaultValue={initial.booking_slug} required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </ActionForm>
  );
}

/** A settings form whose fields are passed as children; shows "Saved" or the error. */
export function SimpleForm({
  action,
  children,
  submitLabel = "Save",
  savedLabel = "Saved.",
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  savedLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && <Notice kind="success">{savedLabel}</Notice>}
      {children}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </ActionForm>
  );
}
