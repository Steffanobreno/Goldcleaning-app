"use client";
import { useState, useTransition } from "react";
import { emailDraftAction, markContactedAction } from "./actions";

/** Email (sends the "finish booking" email now) and Call, which also mark it as contacted. */
export function ContactButtons({ id, phone, className = "" }: { id: string; phone: string; className?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const btn = "rounded-xl border border-line bg-surface py-2.5 text-center text-sm font-semibold text-brand disabled:opacity-50";
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btn} disabled={pending}
          onClick={() => startTransition(async () => setNote(await emailDraftAction(id)))}>
          {pending ? "Sending…" : "Email"}
        </button>
        <button type="button" className={btn}
          onClick={() => { void markContactedAction(id); window.location.href = `tel:${phone}`; }}>
          Call
        </button>
      </div>
      {note && <p role="status" className="text-sm text-muted">{note}</p>}
    </div>
  );
}
