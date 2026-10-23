"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { FormState } from "../../../actions";

export function VaccineForm({ action, names }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  names: string[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-3">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <Field label="Vaccine">
        <Input name="name" list="vaccine-names" placeholder="Rabies" required autoComplete="off" />
        <datalist id="vaccine-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expires"><Input type="date" name="expires_on" required /></Field>
        <Field label="Given (optional)"><Input type="date" name="given_on" /></Field>
      </div>
      <Button type="submit" kind="secondary" disabled={pending} className="w-full">{pending ? "Saving…" : "Add vaccine"}</Button>
    </ActionForm>
  );
}
