"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Input, Notice } from "@/components/ui";
import type { FormState } from "../actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Add an item to a list. */
export function AddOption({ action, placeholder }: { action: Action; placeholder: string }) {
  // A new key after each add empties the box for the next one.
  const [added, setAdded] = useState(0);
  const [state, formAction, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await action(s, f);
    if (r?.saved) setAdded((n) => n + 1);
    return r;
  }, undefined);
  return (
    <ActionForm action={formAction} className="space-y-2" key={added}>
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <div className="flex gap-2">
        <Input name="label" placeholder={placeholder} required maxLength={60} aria-label="New item" className="flex-1" />
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      </div>
    </ActionForm>
  );
}

/** One list item: its name, a rename box when tapped, and move/remove buttons. */
export function OptionRow({ label, rename, move, remove, first, last }: {
  label: string; rename: Action; move: (d: "up" | "down") => Promise<void>; remove: () => Promise<void>;
  first: boolean; last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await rename(s, f);
    if (r?.saved) setEditing(false);
    return r;
  }, undefined);
  const icon = "rounded-lg px-2 py-1 text-sm font-semibold hover:bg-bg disabled:opacity-30";
  if (editing) {
    return (
      <li className="space-y-2 px-4 py-3">
        {state?.error && <Notice kind="error">{state.error}</Notice>}
        <ActionForm action={formAction} className="flex gap-2">
          <Input name="label" defaultValue={label} required maxLength={60} aria-label={`New name for ${label}`} className="flex-1" autoFocus />
          <Button type="submit" disabled={pending}>Save</Button>
          <Button type="button" kind="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </ActionForm>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1 px-4 py-2">
      <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate py-1 text-left font-medium"
        aria-label={`Rename ${label}`}>
        {label}
      </button>
      <button type="button" className={icon} disabled={first} onClick={() => move("up")} aria-label={`Move ${label} up`}>↑</button>
      <button type="button" className={icon} disabled={last} onClick={() => move("down")} aria-label={`Move ${label} down`}>↓</button>
      <button type="button" className={`${icon} text-danger`} aria-label={`Remove ${label}`}
        onClick={() => { if (window.confirm(`Remove “${label}” from the list?`)) remove(); }}>
        Remove
      </button>
    </li>
  );
}
