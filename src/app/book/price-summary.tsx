"use client";
import { useState } from "react";
import { money } from "@/lib/format";
import type { PriceLine } from "@/lib/pricing";

// The price bar stuck to the bottom of the booking page: one line and the total, and the
// price lines when opened. It changes on every choice.
export function PriceSummary({ title, lines, totalCents }: { title: string; lines: PriceLine[]; totalCents: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky bottom-0 z-10 -mx-3 mt-4 rounded-t-3xl border-t-2 border-gold bg-surface px-5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgb(11_31_59/0.10)]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left text-sm text-muted">
        <span className="truncate">{title}</span>
        <span aria-hidden className={`inline-block transition ${open ? "rotate-180" : ""}`}>▲</span>
        <span className="sr-only">{open ? "Hide the price details" : "Show the price details"}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{l.label}{l.kind !== "service" && l.qty > 1 ? ` × ${l.qty}` : ""}</span>
              <span className="tabular-nums">{money(l.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 flex items-baseline justify-between font-serif">
        <span className="text-2xl font-bold">Total</span>
        <span className="text-2xl font-bold tabular-nums" data-testid="book-total">{money(totalCents)}</span>
      </p>
    </div>
  );
}
