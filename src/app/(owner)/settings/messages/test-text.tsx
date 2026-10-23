"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import { queueTestTextAction } from "../actions";

export function TestTextForm({ defaultPhone }: { defaultPhone: string }) {
  const [state, action, pending] = useActionState(queueTestTextAction, undefined);
  return (
    <ActionForm action={action} className="space-y-2">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && (
        <Notice kind="success">
          Test text is waiting. Open Shortcuts on the iPhone and run the automation (▶︎): it goes out in a few seconds.
        </Notice>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Send a test text to">
            <Input name="phone" type="tel" defaultValue={defaultPhone} />
          </Field>
        </div>
        <Button type="submit" kind="secondary" disabled={pending}>{pending ? "…" : "Send test"}</Button>
      </div>
    </ActionForm>
  );
}
