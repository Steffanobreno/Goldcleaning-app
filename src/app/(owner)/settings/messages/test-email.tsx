"use client";
import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendTestEmailAction } from "../actions";

export function TestEmailButton() {
  const [state, action, pending] = useActionState(sendTestEmailAction, undefined);
  return (
    <form action={action} className="space-y-2">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.sentTo && <Notice kind="success">Sent to {state.sentTo}. Check the inbox (and the spam folder the first time).</Notice>}
      <Button type="submit" kind="secondary" disabled={pending}>{pending ? "Sending…" : "Send me a test email"}</Button>
    </form>
  );
}
