"use client";
import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { ACCESS_METHODS } from "@/lib/home-options";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export type ClientValues = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  access_notes: string | null;
  sms_consent: boolean;
};

export function ClientForm({ action, initial, submitLabel }: { action: Action; initial?: ClientValues; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input name="first_name" defaultValue={initial?.first_name} required autoComplete="off" />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={initial?.last_name} autoComplete="off" />
        </Field>
      </div>
      <Field label="Mobile phone" hint="Amanda calls or texts from Google Voice.">
        <Input name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} required placeholder="(650) 555-0123" />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" name="sms_consent" defaultChecked={initial?.sms_consent ?? true} className="mt-1 h-4 w-4" />
        <span>Client agreed to receive text messages about their appointments.</span>
      </label>
      <Field label="Email" hint="Confirmations and reminders go here.">
        <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
      </Field>
      <Field label="Street address">
        <Input name="address_line" defaultValue={initial?.address_line ?? ""} autoComplete="off" placeholder="123 Main St, Apt 4" />
      </Field>
      <div className="grid grid-cols-[1fr_5rem_6rem] gap-3">
        <Field label="City">
          <Input name="city" defaultValue={initial?.city ?? ""} />
        </Field>
        <Field label="State">
          <Input name="state" defaultValue={initial?.state ?? "CA"} maxLength={2} />
        </Field>
        <Field label="ZIP">
          <Input name="zip" inputMode="numeric" defaultValue={initial?.zip ?? ""} maxLength={10} />
        </Field>
      </div>
      <Field label="Notes" hint="Anything about this client (best time to call, how they like to pay).">
        <Textarea name="access_notes" defaultValue={initial?.access_notes ?? ""} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </ActionForm>
  );
}

export type HomeValues = {
  label: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  bedrooms: number;
  full_baths: number;
  half_baths: number;
  access_method: string | null;
  access_code: string | null;
  parking_notes: string | null;
  pets_in_home: string | null;
  product_preferences: string | null;
  notes: string | null;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function HomeForm({ action, initial, offerBooking }: { action: Action; initial?: Partial<HomeValues>; offerBooking?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <Field label="Name" hint="To tell homes apart, like Home or Rental.">
        <Input name="label" defaultValue={initial?.label ?? "Home"} autoComplete="off" />
      </Field>
      <Field label="Street address">
        <Input name="address_line" defaultValue={initial?.address_line ?? ""} autoComplete="off" placeholder="123 Main St, Apt 4" />
      </Field>
      <div className="grid grid-cols-[1fr_5rem_6rem] gap-3">
        <Field label="City">
          <Input name="city" defaultValue={initial?.city ?? ""} />
        </Field>
        <Field label="State">
          <Input name="state" defaultValue={initial?.state ?? "CA"} maxLength={2} />
        </Field>
        <Field label="ZIP">
          <Input name="zip" inputMode="numeric" defaultValue={initial?.zip ?? ""} maxLength={10} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Bedrooms">
          <Select name="bedrooms" defaultValue={String(initial?.bedrooms ?? 1)}>
            {range(0, 7).map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Studio" : n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Full baths">
          <Select name="full_baths" defaultValue={String(initial?.full_baths ?? 1)}>
            {range(1, 7).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Half baths">
          <Select name="half_baths" defaultValue={String(initial?.half_baths ?? 0)}>
            {range(0, 7).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="How we get in">
          <Select name="access_method" defaultValue={initial?.access_method ?? ""}>
            <option value="">Not set</option>
            {ACCESS_METHODS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Code (lockbox, door, gate)">
          <Input name="access_code" defaultValue={initial?.access_code ?? ""} autoComplete="off" />
        </Field>
      </div>
      <Field label="Parking">
        <Input name="parking_notes" defaultValue={initial?.parking_notes ?? ""} placeholder="Driveway, street, permit…" />
      </Field>
      <Field label="Pets in the home">
        <Input name="pets_in_home" defaultValue={initial?.pets_in_home ?? ""} placeholder="1 dog, friendly" />
      </Field>
      <Field label="Products">
        <Input name="product_preferences" defaultValue={initial?.product_preferences ?? ""} placeholder="Green products only, client's own vacuum…" />
      </Field>
      <Field label="Cleaning notes">
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} placeholder="Hardwood floors, no bleach in the master bath…" />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        {offerBooking && (
          <Button type="submit" name="then" value="book" disabled={pending} className="flex-1">
            Save and book
          </Button>
        )}
        <Button type="submit" kind={offerBooking ? "secondary" : "primary"} disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Save home"}
        </Button>
      </div>
    </ActionForm>
  );
}
