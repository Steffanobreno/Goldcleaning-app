"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";

// Tapping a phone number or an address opens a small menu, like on the iPhone:
// phone → Call, Text, Copy; address → Apple Maps, Google Maps, Copy.

export function Sheet({ title, options, onClose }: { title: string; options: { label: string; href?: string; onClick?: () => void }[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 animate-fade" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-sheet">
        <div className="overflow-hidden rounded-2xl bg-surface">
          <p className="border-b border-line px-4 py-3 text-center text-sm text-muted">{title}</p>
          {options.map((o) =>
            o.href?.startsWith("/") ? (
              <Link key={o.label} href={o.href} onClick={onClose}
                className="block border-b border-line px-4 py-3.5 text-center text-lg font-semibold text-brand last:border-0">
                {o.label}
              </Link>
            ) : o.href ? (
              <a key={o.label} href={o.href} target={o.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" onClick={onClose}
                className="block border-b border-line px-4 py-3.5 text-center text-lg font-semibold text-brand last:border-0">
                {o.label}
              </a>
            ) : (
              <button key={o.label} type="button" onClick={() => { o.onClick?.(); onClose(); }}
                className="block w-full border-b border-line px-4 py-3.5 text-center text-lg font-semibold text-brand last:border-0">
                {o.label}
              </button>
            ),
          )}
        </div>
        <button type="button" onClick={onClose} className="block w-full rounded-2xl bg-surface py-3.5 text-lg font-bold">Cancel</button>
      </div>
    </div>
  );
}

const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

export function PhoneLink({ phone, label, className = "", children }: { phone: string; label: string; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children ?? label}</button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)} options={[
          { label: "Call", href: `tel:${phone}` },
          { label: "Text message", href: `sms:${phone}` },
          { label: "Copy number", onClick: () => copy(label) },
        ]} />
      )}
    </>
  );
}

export function AddressLink({ address, lat, lng, className = "", children }: {
  address: string; lat?: number | null; lng?: number | null; className?: string; children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const target = lat != null && lng != null ? `${lat},${lng}` : address;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-left ${className}`}>{children ?? address}</button>
      {open && (
        <Sheet title={address} onClose={() => setOpen(false)} options={[
          { label: "Open in Apple Maps", href: `https://maps.apple.com/?daddr=${encodeURIComponent(target)}&dirflg=d` },
          { label: "Open in Google Maps", href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=driving` },
          { label: "Copy address", onClick: () => copy(address) },
        ]} />
      )}
    </>
  );
}
