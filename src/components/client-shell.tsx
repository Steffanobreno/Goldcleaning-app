import type { ReactNode } from "react";
import { Phone } from "./icons";

// The frame around every page clients see (booking, confirm, cancel): a white header with
// the name and a Call button, and a navy footer, like the website. `bare` drops both when the page sits inside the
// website in an iframe, which already has its own.

export function ClientShell({
  phone,
  phoneLabel,
  website,
  bare = false,
  children,
}: {
  phone: string | null;
  phoneLabel: string;
  website: string | null;
  bare?: boolean;
  children: ReactNode;
}) {
  if (bare) return <main className="mx-auto w-full max-w-lg flex-1 px-3 py-4">{children}</main>;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <a href={website ?? "#"} className="font-serif text-sm font-bold tracking-[0.25em] text-navy">
            GOLD CLEANING
          </a>
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-sm font-semibold text-navy">
              <Phone size={16} /> Call
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-3 py-5">{children}</main>
      <footer className="bg-navy-deep text-white/75">
        <div className="mx-auto max-w-lg space-y-4 px-5 py-8 text-sm">
          <p className="font-serif text-base font-bold tracking-[0.2em] text-gold">PENINSULA GOLD CLEANING</p>
          <p>Home cleaning across the Peninsula and the South Bay.</p>
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-white">
              <Phone size={16} /> {phoneLabel}
            </a>
          )}
        </div>
      </footer>
    </>
  );
}

/** The white card each booking step sits in. */
export function StepCard({ children, className = "", flush = false }: { children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] ${flush ? "" : "p-5 sm:p-7"} ${className}`}
    >
      {children}
    </section>
  );
}
