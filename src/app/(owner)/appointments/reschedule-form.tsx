"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { FormState } from "./actions";
import { DateField } from "@/components/date-field";

export function RescheduleForm({
  action,
  date,
  time,
  following = 0,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  date: string;
  time: string;
  /** How many later visits of its repeating series could move along. */
  following?: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <ActionForm action={formAction} className="space-y-3">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="New date">
          <DateField name="date" defaultValue={date} required />
        </Field>
        <Field label="New time">
          <Input type="time" name="time" defaultValue={time} step={900} required />
        </Field>
      </div>
      {following > 0 && (
        <fieldset className="space-y-1.5 text-sm">
          <legend className="font-semibold">This visit repeats</legend>
          <label className="flex items-center gap-3"><input type="radio" name="scope" value="one" defaultChecked className="h-4 w-4" /> Only this visit</label>
          <label className="flex items-center gap-3">
            <input type="radio" name="scope" value="following" className="h-4 w-4" />
            This one and the next {following} (same number of days earlier or later)
          </label>
        </fieldset>
      )}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" />
        Tell the client about the new time
      </label>
      {state?.warning && (
        <div className="space-y-2">
          <Notice kind="warn">{state.warning}</Notice>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="override" className="h-4 w-4" />
            Move it anyway
          </label>
        </div>
      )}
      <Button type="submit" kind="secondary" disabled={pending}>
        {pending ? "Moving…" : "Move appointment"}
      </Button>
    </ActionForm>
  );
}
