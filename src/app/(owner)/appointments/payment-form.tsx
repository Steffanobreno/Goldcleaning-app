"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Notice } from "@/components/ui";
import { ArrowLeft, ChevronRight } from "@/components/icons";
import { money } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import type { FormState } from "./actions";

// Taking payment in three short steps, like at the counter:
// 1. tip (a percent of the services, a custom amount, or none);
// 2. how they paid;
// 3. the amount (cash shows the change), who paid and a note → "Charge $X".

const TIP_PERCENTS = [15, 20, 25];
const toCents = (s: string) => Math.round(Number(s.replace(/[$,\s]/g, "") || 0) * 100) || 0;

export function PaymentForm({
  action,
  balanceCents,
  serviceCents,
  clientName,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  balanceCents: number; // still due on the bill, before the tip
  serviceCents: number; // the services after discounts: tips are a percent of this
  clientName: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState<"tip" | "method" | "details">("tip");
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [tendered, setTendered] = useState("");

  const amountCents = toCents(amount);
  const tipCents = customTip !== null ? toCents(customTip) : tip;
  const charge = amountCents + tipCents;
  const change = toCents(tendered) - charge;
  const label = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? "";
  const back = (to: typeof step) => (
    <button type="button" onClick={() => setStep(to)} aria-label="Back" className="-ml-2 rounded-full p-2 hover:bg-bg">
      <ArrowLeft size={22} />
    </button>
  );
  const pill = "block w-full rounded-full border-2 border-brand px-4 py-3.5 text-center font-bold hover:bg-brand-soft";

  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="tip" value={(tipCents / 100).toFixed(2)} />

      {step === "tip" && (
        <div className="space-y-3">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold">Add a tip</h2>
            <p className="text-sm text-muted">Based on service total: {money(serviceCents)}</p>
          </div>
          {TIP_PERCENTS.map((p) => {
            const cents = Math.round((serviceCents * p) / 100);
            return (
              <button key={p} type="button" className={pill} onClick={() => { setTip(cents); setCustomTip(null); setStep("method"); }}>
                {money(cents)} ({p}%)
              </button>
            );
          })}
          {customTip === null ? (
            <button type="button" className={pill} onClick={() => setCustomTip("")}>Custom tip amount</button>
          ) : (
            <div className="flex gap-2">
              <label className="flex flex-1 items-center gap-1 rounded-full border-2 border-brand px-4">
                $
                <input autoFocus inputMode="decimal" aria-label="Tip amount" value={customTip} onChange={(e) => setCustomTip(e.target.value)}
                  className="w-full bg-transparent py-3 font-bold outline-none" placeholder="0.00" />
              </label>
              <button type="button" className="rounded-full bg-brand px-6 font-bold text-white" onClick={() => setStep("method")}>Next</button>
            </div>
          )}
          <button type="button" className="block w-full py-3 text-center font-semibold text-muted" onClick={() => { setTip(0); setCustomTip(null); setStep("method"); }}>
            No tip
          </button>
        </div>
      )}

      {step === "method" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {back("tip")}
            <h2 className="text-xl font-extrabold">Select payment method</h2>
          </div>
          <ul className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <li key={m.value}>
                <button type="button" onClick={() => { setMethod(m.value); setStep("details"); }}
                  className="card flex w-full items-center justify-between px-4 py-4 text-left font-semibold hover:bg-bg">
                  {m.value === "cash" || m.value === "check" ? `Check out with ${m.label}` : m.label}
                  <ChevronRight size={20} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {back("method")}
            <h2 className="text-xl font-extrabold">{label}</h2>
          </div>
          <div className="card divide-y divide-line">
            <label className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">Amount</span>
              <span className="flex items-center gap-1">$<input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-28 rounded-lg border border-line px-2 py-1.5 text-right" /></span>
            </label>
            {tipCents > 0 && (
              <div className="flex justify-between px-4 py-3 text-sm"><span className="text-muted">Tip</span><span>{money(tipCents)}</span></div>
            )}
            {method === "cash" && (
              <>
                <label className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-semibold">Cash tendered</span>
                  <span className="flex items-center gap-1">$<input inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="0.00"
                    aria-label="Cash tendered" className="w-28 rounded-lg border border-line px-2 py-1.5 text-right" /></span>
                </label>
                {tendered && (
                  <div className={`flex justify-between px-4 py-3 font-bold ${change < 0 ? "text-danger" : "text-success"}`}>
                    <span>{change < 0 ? "Still short" : "Change due"}</span><span>{money(Math.abs(change))}</span>
                  </div>
                )}
              </>
            )}
            {method !== "cash" && (
              <label className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-semibold">{method === "check" ? "Check number" : "Reference"}</span>
                <input name="reference" autoComplete="off" placeholder="Optional" className="w-40 rounded-lg border border-line px-2 py-1.5 text-right" />
              </label>
            )}
            <label className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">Paid by</span>
              <input name="paid_by" defaultValue={clientName} className="w-48 rounded-lg border border-line px-2 py-1.5 text-right" />
            </label>
          </div>
          <textarea name="note" rows={3} placeholder="Description" aria-label="Description"
            className="card block w-full px-4 py-3 outline-none focus:border-brand" />
          <button type="submit" disabled={pending || charge <= 0}
            className="block w-full rounded-full bg-brand py-4 text-lg font-bold text-white shadow-[0_6px_16px_rgb(10_132_204/0.25)] disabled:opacity-40">
            {pending ? "Saving…" : `Charge ${money(charge)}`}
          </button>
        </div>
      )}
    </ActionForm>
  );
}
