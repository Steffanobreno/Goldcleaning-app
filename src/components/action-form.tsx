"use client";
import { startTransition, type ComponentProps } from "react";

/**
 * A <form> that submits to a server action without React's automatic reset,
 * so the fields keep what was typed when the action returns an error.
 */
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (form: FormData) => void }) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(form));
      }}
    />
  );
}
