"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// The ☰ menu: opens from the left with the logo, the owner's name and every section of
// the app. The header's menu button opens it with a window event, so any page header can.

const OPEN = "woofers:open-menu";
export const openMenu = () => window.dispatchEvent(new Event(OPEN));

const ITEMS = [
  { href: "/today", label: "Today's route", icon: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" },
  { href: "/calendar", label: "Appointments", icon: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 7h14v10H5V9Z" },
  { href: "/clients", label: "Clients & pets", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" },
  { href: "/requests", label: "Booking requests", icon: "M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" },
  { href: "/abandoned", label: "Abandoned bookings", icon: "M7 4h10l1 3H6l1-3Zm-2 5h14l-1.2 10.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8L5 9Zm4 3v6h2v-6H9Zm4 0v6h2v-6h-2Z" },
  { href: "/marketing", label: "Marketing", icon: "M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" },
  { href: "/reports", label: "Finance & reports", icon: "M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z" },
  { href: "/settings/messages", label: "Texts and email", icon: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z" },
  { href: "/settings", label: "Settings", icon: "M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1L11 21h4l.4-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" },
];

export function SideMenu({ staffName, businessName, requests }: { staffName: string; businessName: string; requests: number }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN, show);
    return () => window.removeEventListener(OPEN, show);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex animate-fade" onClick={() => setOpen(false)}>
      <nav aria-label="Menu" onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[78%] max-w-xs flex-col overflow-y-auto bg-navy-deep pb-[env(safe-area-inset-bottom)] pt-[max(1.5rem,env(safe-area-inset-top))] text-white shadow-2xl">
        <div className="px-6 pb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
          <img src="/logo.png" alt="" width={400} height={380} className="mx-auto h-24 w-24 rounded-full bg-white object-contain p-3.5" />
          <p className="mt-3 font-bold">{staffName} <span className="font-normal text-white/60">(Owner)</span></p>
          <p className="text-sm text-white/60">{businessName}</p>
        </div>
        <ul className="flex-1 space-y-1 px-3">
          {ITEMS.map((i) => {
            const active = path === i.href || (i.href !== "/settings" && path.startsWith(i.href + "/"));
            return (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-4 rounded-xl px-3 py-3.5 text-lg font-semibold ${active ? "bg-white/10 text-sky" : "hover:bg-white/5"}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor" aria-hidden><path d={i.icon} /></svg>
                  {i.label}
                  {i.href === "/requests" && requests > 0 && (
                    <span className="ml-auto rounded-full bg-sky px-2 py-0.5 text-xs font-bold text-navy">{requests}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex-1 bg-black/50" aria-hidden />
    </div>
  );
}

export function MenuButton() {
  return (
    <button type="button" onClick={openMenu} aria-label="Open menu" className="-ml-2 rounded-lg p-2 text-white hover:bg-white/10">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <path d="M4 6h16M4 12h12M4 18h16" />
      </svg>
    </button>
  );
}
