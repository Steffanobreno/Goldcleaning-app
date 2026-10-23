"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Notice } from "@/components/ui";
import { importClientsAction } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importClientsAction, undefined);
  const r = state?.report;
  return (
    <div className="space-y-4">
      <ActionForm action={action} className="space-y-4">
        {state?.error && <Notice kind="error">{state.error}</Notice>}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Client export (.csv)</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm" />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="appointments" defaultChecked className="mt-1 h-4 w-4" />
          <span>Also bring each client&apos;s next upcoming visit (you add the services later).</span>
        </label>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Importing… this can take a minute" : "Import clients"}
        </Button>
      </ActionForm>
      {r && (
        <div className="space-y-2">
          <Notice kind="success">
            {r.created} clients and {r.pets} pets imported, {r.appointments} upcoming visits.
            {r.existing > 0 && ` ${r.existing} were already here and were left as they are.`}
          </Notice>
          {r.moreUpcoming.length > 0 && (
            <Notice kind="warn">
              Only the next visit came over for: {r.moreUpcoming.join(", ")}. Add their later visits by hand.
            </Notice>
          )}
          {[...r.skipped, ...r.problems].length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {r.skipped.length + r.problems.length} rows need a look
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {[...r.skipped, ...r.problems].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
