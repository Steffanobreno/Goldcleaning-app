"use client";
import { useActionState } from "react";
import { quickMoveAction } from "../../../appointments/actions";
import { DateField } from "@/components/date-field";
import { Button, Input, Notice } from "@/components/ui";
import Link from "next/link";

/** One coming visit with its own date, time and Move button. */
export function UpcomingRow({ id, date, time, label, recurring }: {
  id: string; date: string; time: string; label: string; recurring: boolean;
}) {
  const [state, action, pending] = useActionState(quickMoveAction.bind(null, id), undefined);
  return (
    <li className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/appointments/${id}`} className="font-bold">{label}</Link>
        {recurring && <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">Repeats</span>}
      </div>
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <DateField name="date" defaultValue={date} required />
          <Input type="time" name="time" defaultValue={time} step={900} required aria-label="Time" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" /> Email the client the new time
        </label>
        {state?.error && <Notice kind="error">{state.error}</Notice>}
        {state?.warning && (
          <div className="space-y-2">
            <Notice kind="warn">{state.warning}</Notice>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="override" className="h-4 w-4" /> Move it anyway</label>
          </div>
        )}
        {state?.ok && <Notice kind="success">Moved.</Notice>}
        <Button type="submit" kind="secondary" disabled={pending}>{pending ? "Moving…" : "Move"}</Button>
      </form>
    </li>
  );
}
