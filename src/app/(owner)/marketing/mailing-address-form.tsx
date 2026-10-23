"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Input, Notice } from "@/components/ui";
import { saveMailingAddressAction } from "./actions";

export function MailingAddressForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState(saveMailingAddressAction, undefined);
  return (
    <ActionForm action={action} className="space-y-2">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && <Notice kind="success">Saved.</Notice>}
      <Input name="mailing_address" defaultValue={value} placeholder="PO Box 123, Redwood City, CA 94063" aria-label="Mailing address" />
      <Button type="submit" kind="secondary" disabled={pending}>{pending ? "Saving…" : "Save address"}</Button>
    </ActionForm>
  );
}
