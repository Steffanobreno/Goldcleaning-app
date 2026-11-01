import Link from "next/link";

const ICONS = {
  bell: "M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z",
  cart: "M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM1 2v2h2l3.6 7.6-1.4 2.4c-.1.3-.2.6-.2 1 0 1.1.9 2 2 2h12v-2H7.4a.25.25 0 0 1-.2-.4l.9-1.6h7.4c.8 0 1.4-.4 1.7-1l3.6-6.5A1 1 0 0 0 20 2H5.2l-.9-2H1Z",
} as const;

/**
 * Navy and gold: for what is money waiting for an answer (booking requests, unfinished
 * online bookings). A gold badge with the count, two lines of text and a gold button.
 */
export function GoldBanner({ href, count, title, text, action, icon, compact = false }: {
  href: string; count: number; title: string; text: string; action: string; icon: keyof typeof ICONS;
  /** One slim line (Today, where the map needs the room). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Link href={href}
        className="group flex items-center gap-2.5 rounded-full border border-[#d4af37]/70 bg-gradient-to-r from-[#0b1f3a] via-[#12305a] to-[#0b1f3a] py-1 pl-1 pr-1 shadow-[0_3px_10px_rgb(11_31_58/0.3)]">
        <span aria-hidden className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f7e7a1] via-[#d4af37] to-[#a8811f] text-[#0b1f3a]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d={ICONS[icon]} /></svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-white">{title}</span>
        <span className="shrink-0 rounded-full bg-gradient-to-r from-[#f7e7a1] to-[#d4af37] px-3 py-1 text-xs font-bold text-[#0b1f3a] transition-transform group-active:scale-95">
          {action} ›
        </span>
      </Link>
    );
  }
  return (
    <Link href={href}
      className="group flex items-center gap-3 rounded-2xl border border-[#d4af37]/70 bg-gradient-to-br from-[#0b1f3a] via-[#12305a] to-[#0b1f3a] px-4 py-3 shadow-[0_6px_20px_rgb(11_31_58/0.35),inset_0_1px_0_rgb(255_255_255/0.08)]">
      <span aria-hidden className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f7e7a1] via-[#d4af37] to-[#a8811f] text-[#0b1f3a] shadow-[0_0_14px_rgb(212_175_55/0.55)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={ICONS[icon]} /></svg>
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-[#0b1f3a] ring-2 ring-[#d4af37]">
          {count}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-white">{title}</span>
        <span className="block text-sm text-[#e9d38a]">{text}</span>
      </span>
      <span className="shrink-0 rounded-full bg-gradient-to-r from-[#f7e7a1] to-[#d4af37] px-3 py-1.5 text-sm font-bold text-[#0b1f3a] transition-transform group-active:scale-95">
        {action} ›
      </span>
    </Link>
  );
}
