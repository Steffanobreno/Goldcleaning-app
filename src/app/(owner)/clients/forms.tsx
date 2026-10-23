"use client";
import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { SIZES } from "@/lib/format";
import { BreedOptions } from "@/components/breed-options";
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
      <Field label="Mobile phone" hint="Texts and reminders go to this number.">
        <Input name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} required placeholder="(650) 555-0123" />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" name="sms_consent" defaultChecked={initial?.sms_consent ?? true} className="mt-1 h-4 w-4" />
        <span>Client agreed to receive text messages about their appointments.</span>
      </label>
      <Field label="Email (optional)">
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
      <Field label="Parking and access notes" hint="Gate code, where to park the van, water or power outlet.">
        <Textarea name="access_notes" defaultValue={initial?.access_notes ?? ""} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </ActionForm>
  );
}

export type PetValues = {
  name: string;
  breed: string | null;
  size_class: string | null;
  weight_lbs: string | null;
  coat_type: string | null;
  birth_date: string | null;
  sex: string | null;
  behavior: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  notes: string | null;
  rebook_every_days: number | null;
};

export function PetForm({
  action,
  initial,
  offerBooking,
}: {
  action: Action;
  initial?: PetValues;
  offerBooking?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pet name">
          <Input name="name" defaultValue={initial?.name} required autoComplete="off" />
        </Field>
        <Field label="Breed">
          <Input name="breed" defaultValue={initial?.breed ?? ""} list="dog-breeds" autoComplete="off" placeholder="Start typing…" />
          <BreedOptions />
        </Field>
      </div>
      <Field label="Size (height at the shoulder)" hint="Picks the right price when booking.">
        <Select name="size_class" defaultValue={initial?.size_class ?? ""}>
          <option value="">Not set</option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Weight (lb)">
          <Input name="weight_lbs" inputMode="decimal" defaultValue={initial?.weight_lbs ?? ""} />
        </Field>
        <Field label="Sex">
          <Select name="sex" defaultValue={initial?.sex ?? ""}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </Field>
        <Field label="Birthday">
          <Input name="birth_date" type="date" defaultValue={initial?.birth_date ?? ""} />
        </Field>
      </div>
      <Field label="Coat">
        <Input name="coat_type" defaultValue={initial?.coat_type ?? ""} placeholder="Double coat, curly, wire…" />
      </Field>
      <Field label="Groom every (days)" hint="Used for the rebook reminder. Leave empty if unknown.">
        <Input name="rebook_every_days" inputMode="numeric" defaultValue={initial?.rebook_every_days ?? ""} placeholder="42" />
      </Field>
      <Field label="Behavior">
        <Textarea name="behavior" defaultValue={initial?.behavior ?? ""} placeholder="Nervous with dryer, nips at paws…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vet">
          <Input name="vet_name" defaultValue={initial?.vet_name ?? ""} />
        </Field>
        <Field label="Vet phone">
          <Input name="vet_phone" type="tel" defaultValue={initial?.vet_phone ?? ""} />
        </Field>
      </div>
      <Field label="Grooming notes">
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} placeholder="#7 blade body, scissor face…" />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        {offerBooking && (
          <Button type="submit" name="then" value="book" disabled={pending} className="flex-1">
            Save and book
          </Button>
        )}
        <Button type="submit" kind={offerBooking ? "secondary" : "primary"} disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Save pet"}
        </Button>
      </div>
    </ActionForm>
  );
}
