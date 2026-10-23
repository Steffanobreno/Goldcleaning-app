"use client";
import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { loginAction, setupAction } from "./actions";

export function LoginForm({ mode }: { mode: "login" | "setup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? loginAction : setupAction, undefined);
  return (
    <ActionForm action={action} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint={mode === "setup" ? "At least 10 characters." : undefined}>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </Field>
      {mode === "setup" && (
        <Field label="Setup code" hint="The code you put in the server settings (SETUP_CODE).">
          <Input name="setup_code" autoComplete="off" />
        </Field>
      )}
      {mode === "setup" && (
        <Field label="Repeat password">
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "One moment…" : mode === "login" ? "Log in" : "Create my account"}
      </Button>
    </ActionForm>
  );
}
