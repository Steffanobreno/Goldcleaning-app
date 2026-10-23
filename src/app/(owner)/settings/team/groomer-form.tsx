"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { TeamState } from "./actions";

export function GroomerForm({ action, colors, initial, isOwner = false, submit }: {
  action: (s: TeamState, f: FormData) => Promise<TeamState>;
  colors: string[];
  initial?: { name: string; color: string; phone: string; email: string; active: boolean };
  isOwner?: boolean;
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [color, setColor] = useState(initial?.color ?? colors[1]);
  return (
    <ActionForm action={formAction} className="space-y-3" key={state?.saved ? "saved" : "form"}>
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && <Notice kind="success">Added.</Notice>}
      <Field label="Name"><Input name="name" defaultValue={initial?.name} required placeholder="Maria" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile (optional)"><Input name="phone" defaultValue={initial?.phone} inputMode="tel" placeholder="(650) 555-0100" /></Field>
        <Field label="Email (optional)"><Input name="email" type="email" defaultValue={initial?.email} placeholder="maria@gmail.com" /></Field>
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium">Color on the calendar</span>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c}
              className={`h-9 w-9 rounded-full border-4 ${color === c ? "border-ink" : "border-white"} shadow`} style={{ background: c }} />
          ))}
        </div>
      </div>
      {initial && !isOwner && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
          Active (shows in the booking form and on the calendar)
        </label>
      )}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : submit}</Button>
    </ActionForm>
  );
}
