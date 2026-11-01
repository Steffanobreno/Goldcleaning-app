"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import "leaflet/dist/leaflet.css";
import { drawDayMap, type MapEngine } from "./map-engines";
import { setStatusAction } from "@/app/(owner)/appointments/actions";

// The day as a map with the visits as cards along the bottom.
// Swiping the cards moves to the next visit and centers its pin; tapping a pin shows its card.
// OpenStreetMap (see map-engines.ts).

export type DayStop = {
  id: string;
  n: number;
  lat: number | null;
  lng: number | null;
  time: string; // "8:45 AM – 10:45 AM"
  status: { label: string; className: string };
  client: string;
  initials: string;
  isNew: boolean;
  visit: string; // "Regular Clean · 2 bd / 1 ba"
  phone: string;
  address: string | null;
  directions: string | null;
  next: { to: string; label: string } | null;
  total: string; // "$191.00"
  notes: string[]; // "🔑 Lockbox · 1234", "🐾 2 dogs"
};

export function DayMap({ stops, route, compact = false }: {
  stops: DayStop[]; route?: string | null;
  /** Smaller, when the whole month is open above it. */
  compact?: boolean;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const engine = useRef<MapEngine | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [active, setActive] = useState(0);
  const [height, setHeight] = useState<number | null>(null);
  const key = JSON.stringify(stops.map((s) => [s.id, s.lat, s.lng]));

  const show = (i: number, smooth = true) => {
    const card = rail.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
  };

  // Fill the screen from the map's top down to the tab bar, so the cards are never under it.
  useEffect(() => {
    if (compact) return;
    const fit = () => {
      const el = outer.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Main"]');
      const navTop = nav && getComputedStyle(nav).position === "fixed" ? nav.getBoundingClientRect().top : window.innerHeight;
      setHeight(Math.max(380, Math.floor(navTop - top)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [compact]);

  // The map, its pins and the route (Google Maps when its key is set, OpenStreetMap otherwise).
  // One drawing at a time: a redraw waits until the previous map is drawn and removed.
  useEffect(() => {
    let cancelled = false;
    let drawn: MapEngine | undefined;
    const run = queue.current.then(async () => {
      if (cancelled || !box.current) return;
      const d = await drawDayMap({ box: box.current, stops, onPin: (i) => show(i) });
      if (cancelled) return d.destroy();
      drawn = engine.current = d;
      d.focus(stops[active]);
    });
    queue.current = run.catch(() => {});
    return () => {
      cancelled = true;
      drawn?.destroy();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw only when the stops change
  }, [key]);

  // The card in the middle of the rail is the active visit: highlight and center its pin.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      [...el.children].forEach((c, i) => {
        const card = c as HTMLElement;
        if (Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid) < Math.abs((el.children[best] as HTMLElement).offsetLeft + (el.children[best] as HTMLElement).offsetWidth / 2 - mid)) best = i;
      });
      setActive(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    engine.current?.focus(stops[active]);
  }, [active, stops]);

  return (
    // Fills the screen between the week and the tab bar.
    <div ref={outer} className="relative isolate z-0 overflow-hidden"
      style={compact ? { height: 330 } : { height: height ?? "calc(100dvh - 18rem - env(safe-area-inset-bottom))", minHeight: 380 }}>
      <div ref={box} className="absolute inset-0" role="img" aria-label="Map of the day's visits" />
      {route && (
        <a href={route} target="_blank" rel="noopener"
          className="absolute right-3 top-3 z-[500] rounded-full bg-surface px-3 py-2 text-sm font-bold text-brand shadow-lg">
          Route in Google Maps ↗
        </a>
      )}
      {stops.length > 0 && (
        <div ref={rail} role="list" aria-label="Visits"
          className="absolute inset-x-0 bottom-3 z-[500] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[7.5%] pb-1 [scrollbar-width:none]">
          {stops.map((s, i) => <Card key={s.id} s={s} active={i === active} />)}
        </div>
      )}
    </div>
  );
}

function Card({ s, active }: { s: DayStop; active: boolean }) {
  const [contact, setContact] = useState(false);
  const [pending, start] = useTransition();
  const button = "flex flex-1 flex-col items-center gap-1 py-2.5 text-sm font-semibold text-brand disabled:opacity-50";
  return (
    <article role="listitem" aria-current={active || undefined}
      className={`w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ${active ? "ring-brand" : "ring-line"}`}>
      <div className="flex items-center justify-between gap-2 whitespace-nowrap bg-navy px-4 py-2 text-[13px] font-bold text-white">
        <span>{s.n}. {s.time}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${s.status.className}`}>{s.status.label}</span>
      </div>
      <Link href={`/appointments/${s.id}`} className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{s.initials}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-lg font-bold">{s.client}</span>
            {s.isNew && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
          </span>
          <span className="block truncate text-sm font-semibold text-muted">{s.visit} · {s.total}</span>
          {s.notes.map((a) => <span key={a} className="block truncate text-xs text-muted">{a}</span>)}
        </span>
      </Link>
      {contact ? (
        <div className="flex border-t border-line">
          <a href={`tel:${s.phone}`} className={button}>Call</a>
          <a href={`sms:${s.phone}`} className={button}>Text</a>
          <button type="button" onClick={() => setContact(false)} className={`${button} text-muted`}>Close</button>
        </div>
      ) : (
        <div className="flex border-t border-line">
          <button type="button" onClick={() => setContact(true)} className={button}>Contact</button>
          {s.directions ? <a href={s.directions} target="_blank" rel="noopener" className={button}>Directions</a>
            : <span className={`${button} text-muted`}>No address</span>}
          {s.next ? (
            <button type="button" disabled={pending} className={button}
              onClick={() => start(() => setStatusAction(s.id, s.next!.to))}>
              {pending ? "…" : s.next.label}
            </button>
          ) : (
            <Link href={`/appointments/${s.id}`} className={button}>Open</Link>
          )}
        </div>
      )}
    </article>
  );
}
