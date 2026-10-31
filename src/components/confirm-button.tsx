"use client";
import type { ComponentProps } from "react";

/** A submit button that asks "are you sure?" first, for actions that take a visit off the day. */
export function ConfirmButton({ question, ...props }: ComponentProps<"button"> & { question: string }) {
  return (
    <button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    />
  );
}
