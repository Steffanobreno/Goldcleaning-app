import type { ReactNode } from "react";
import { Phone } from "./icons";

// The frame around every page clients see (booking, confirm, cancel): the Woofers navy
// header and footer, like the website. `bare` drops both when the page sits inside the
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
      <header className="sticky top-0 z-20 bg-navy">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <a href={website ?? "#"} aria-label="Woofers Dog Spa home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
            <img src="/logo-light.png" alt="Woofers Dog Spa" width={594} height={160} className="h-11 w-auto" />
          </a>
          {phone && (
            <a
              href={`sms:${phone}`}
              className="rounded-xl bg-sky px-4 py-2.5 text-sm font-bold text-navy shadow-[0_0_18px_rgb(25_178_230/0.35)]"
            >
              Text us
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-3 py-5">{children}</main>
      <footer className="bg-navy-deep text-white/75">
        <div className="mx-auto max-w-lg space-y-4 px-5 py-8 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
          <img src="/logo-light.png" alt="" width={594} height={160} className="h-12 w-auto" />
          <p>Premium mobile dog grooming delivered right to your doorstep in the Bay Area, CA.</p>
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
