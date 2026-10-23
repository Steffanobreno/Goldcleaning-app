"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { SIZES, WEEKDAYS } from "@/lib/format";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export type ServiceValues = {
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  duration_min: number;
  price_cents: number;
  description: string | null;
  active: boolean;
  online_bookable: boolean;
};

export function ServiceForm({ action, initial, categories }: { action: Action; initial?: ServiceValues; categories: string[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <Field label="Name">
        <Input name="name" defaultValue={initial?.name} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select name="kind" defaultValue={initial?.kind ?? "service"}>
            <option value="service">Service</option>
            <option value="addon">Add-on</option>
          </Select>
        </Field>
        <Field label="Category">
          <Input name="category" defaultValue={initial?.category ?? ""} list="categories" placeholder="Bath" />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Pet size" hint="Leave as 'Any size' for services that cost the same for every dog.">
        <Select name="size_class" defaultValue={initial?.size_class ?? ""}>
          <option value="">Any size</option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price ($)">
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={initial ? (initial.price_cents / 100).toFixed(2) : ""}
            required
          />
        </Field>
        <Field label="Time (minutes)" hint="0 for add-ons that take no extra time.">
          <Input name="duration_min" type="number" min={0} max={600} step={5} defaultValue={initial?.duration_min ?? 60} required />
        </Field>
      </div>
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
