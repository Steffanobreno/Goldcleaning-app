"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Sheet } from "@/components/contact-sheet";

/** An empty hour on the day view: tap it to book a visit or block the time. */
export function SlotButton({ date, time, groomer, label, className, style, children }: {
  date: string; time: string; groomer?: string | null; label: string; className: string; style: CSSProperties; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style} aria-label={`${label}: book or block`}>
        {children}
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)} options={[
          { label: "New appointment", href: `/appointments/new?date=${date}&time=${time}${groomer ? `&groomer=${groomer}` : ""}` },
          { label: "Block time", href: `/calendar/block?date=${date}&start=${time}${groomer ? `&groomer=${groomer}` : ""}` },
        ]} />
      )}
    </>
  );
}
