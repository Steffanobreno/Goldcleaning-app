"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { FormState } from "../../appointments/actions";

// Blocked time: a date, a start and an end (or all day), a description,
// and for a new block an optional weekly repeat.

export function BlockForm({ action, initial, isNew, groomers = [], defaultGroomer }: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: { date: string; start: string; end: string; allDay: boolean; reason: string };
  isNew: boolean;
  groomers?: { id: string; name: string; color: string }[]; // whose time it blocks, when there's more than one
  defaultGroomer?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [repeat, setRepeat] = useState("0");
  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <Card className="space-y-3">
        {isNew && groomers.length > 1 && (
          <div>
            <span className="mb-2 block text-sm font-medium">Whose time</span>
            <div className="flex flex-wrap gap-2">
              {groomers.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="radio" name="staff_id" value={g.id} defaultChecked={g.id === (defaultGroomer ?? groomers[0].id)} className="sr-only" />
                  <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <Field label="Date">
          <Input type="date" name="date" defaultValue={initial.date} required />
        </Field>
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="font-semibold">All day</span>
          <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-6 w-6 accent-brand" />
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="time" name="start" step={900} defaultValue={initial.start} required /></Field>
            <Field label="End"><Input type="time" name="end" step={900} defaultValue={initial.end} required /></Field>
          </div>
        )}
      </Card>
      <Card className="space-y-3">
        <Field label="Description">
          <Textarea name="reason" defaultValue={initial.reason} placeholder="Lunch, van service, personal…" />
        </Field>
      </Card>
      {isNew && (
        <Card className="space-y-3">
          <Field label="Repeat">
            <Select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="0">Does not repeat</option>
              <option value="1">Every week</option>
              <option value="2">Every 2 weeks</option>
            </Select>
          </Field>
          {repeat !== "0" && (
            <Field label="Repeat until">
              <Input type="date" name="until" min={initial.date} required />
            </Field>
          )}
        </Card>
      )}
      <Button type="submit" disabled={pending} className="w-full py-3.5 text-base">
        {pending ? "Saving…" : isNew ? "Block this time" : "Save"}
      </Button>
    </ActionForm>
  );
}
