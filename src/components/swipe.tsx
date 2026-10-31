"use client";
import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Turn = string | (() => void) | null | undefined;

/**
 * Swipe left for `next`, right for `prev`, like turning pages: the content follows the finger,
 * and a long enough swipe turns the page (a link to open, or a function to call). Only clear
 * sideways swipes count, so scrolling up and down is never mistaken for one.
 */
export function Swipe({ prev, next, className, children, label }: {
  prev?: Turn; next?: Turn; className?: string; children: ReactNode; label?: string;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number; sideways: boolean | null } | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [loading, startLoading] = useTransition();
  // Where the new page slides in from once it has arrived (null: nothing pending).
  const enter = useRef<number | null>(null);
  const move = (x: number, animate: boolean) => {
    const el = inner.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.18s ease-out, opacity 0.18s ease-out" : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
    el.style.opacity = x ? String(Math.max(0.35, 1 - Math.abs(x) / 600)) : "";
  };
  const slideIn = (from: number) => {
    move(from, false);
    requestAnimationFrame(() => requestAnimationFrame(() => move(0, true)));
  };
  useEffect(() => {
    if (!loading && enter.current !== null) {
      slideIn(enter.current);
      enter.current = null;
    }
  });
  return (
    <div
      className="overflow-hidden"
      aria-label={label}
      // Sideways swipes here are ours (not the browser's back/forward); scrolling up and down still works.
      style={{ touchAction: "pan-y", overscrollBehaviorX: "contain" }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY, sideways: null };
      }}
      onTouchMove={(e) => {
        const s = start.current;
        if (!s) return;
        const t = e.touches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        // Decide once, after a little movement, whether this is a sideways swipe.
        if (s.sideways === null && Math.abs(dx) + Math.abs(dy) > 10) s.sideways = Math.abs(dx) > Math.abs(dy) * 1.2;
        if (!s.sideways) return;
        // Resist where there's nothing to turn to.
        const blocked = (dx < 0 && !next) || (dx > 0 && !prev);
        move(blocked ? dx / 4 : dx, false);
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        const to = dx < 0 ? next : prev;
        if (!s.sideways || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2 || !to) return move(0, true);
        // Slide out the way the finger went, then show the new page sliding in from the other side.
        const w = inner.current?.offsetWidth ?? 400;
        move(dx < 0 ? -w : w, true);
        const from = dx < 0 ? w / 3 : -w / 3;
        setTimeout(() => {
          if (typeof to === "function") {
            to();
            slideIn(from);
          } else {
            // A link: the new page slides in once it has loaded.
            enter.current = from;
            startLoading(() => router.push(to));
          }
        }, 160);
      }}
      onTouchCancel={() => {
        start.current = null;
        move(0, true);
      }}
    >
      <div ref={inner} className={className}>{children}</div>
    </div>
  );
}
