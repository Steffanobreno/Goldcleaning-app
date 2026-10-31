"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

// A client list you can search as you type (no waiting on the server: the list is already
// here) and jump through with the A–Z strip on the right edge: touch a letter, or slide the
// finger down the strip, and the list goes straight to the names with that letter.
//
// The rows come from the page: each <li> carries data-search (what typing matches) and
// data-letter (the first letter of the name, for the A–Z strip).

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
const letterOf = (s: string | undefined) => {
  const c = (s ?? "").trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
};
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ClientFinder({ children, initialQuery = "", placeholder = "Search by name, phone or pet", autoFocus = false, form }: {
  children: ReactNode; initialQuery?: string; placeholder?: string; autoFocus?: boolean;
  /** Hidden fields to keep when the search is sent to the server (Enter). */
  form?: ReactNode;
}) {
  const [q, setQ] = useState(initialQuery);
  const list = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [bubble, setBubble] = useState<string | null>(null);

  // Show only the rows that match what's typed; the letters follow what's shown.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const words = fold(q).split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, "");
    const seen = new Set<string>();
    el.querySelectorAll<HTMLElement>("[data-search]").forEach((row) => {
      const text = fold(row.dataset.search ?? "");
      const show = words.length === 0 || words.every((w) => text.includes(w)) || (digits.length >= 3 && text.replace(/\D/g, "").includes(digits));
      row.hidden = !show;
      if (show) seen.add(letterOf(row.dataset.letter));
    });
    setPresent(seen);
  }, [q, children]);

  const jump = (letter: string) => {
    const el = list.current;
    if (!el) return;
    // The first shown row with that letter, or the next letter that has one.
    const from = LETTERS.indexOf(letter);
    for (const l of LETTERS.slice(from)) {
      const row = [...el.querySelectorAll<HTMLElement>("[data-search]")].find((r) => !r.hidden && letterOf(r.dataset.letter) === l);
      if (row) {
        window.scrollTo({ top: row.getBoundingClientRect().top + window.scrollY - 120 });
        break;
      }
    }
    setBubble(letter);
  };
  const fromTouch = (y: number, strip: HTMLElement) => {
    const r = strip.getBoundingClientRect();
    const i = Math.min(LETTERS.length - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * LETTERS.length)));
    jump(LETTERS[i]);
  };
  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(null), 600);
    return () => clearTimeout(t);
  }, [bubble]);

  return (
    <div className="space-y-3">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        {form}
        <label className="sr-only" htmlFor="q">Search clients</label>
        <input id="q" name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
          autoComplete="off" className="block w-full rounded-full border border-line bg-surface px-5 py-2.5 text-ink placeholder:text-muted focus:border-brand focus:outline-none" />
      </form>
      <div ref={list} className="pr-6">{children}</div>
      {present.size > 4 && (
        <nav aria-label="Jump to letter"
          className="fixed right-0.5 top-1/2 z-20 flex -translate-y-1/2 touch-none select-none flex-col items-center rounded-full bg-surface/80 px-0.5 py-1 backdrop-blur"
          onTouchStart={(e) => fromTouch(e.touches[0].clientY, e.currentTarget)}
          onTouchMove={(e) => fromTouch(e.touches[0].clientY, e.currentTarget)}>
          {LETTERS.map((l) => (
            <button key={l} type="button" onClick={() => jump(l)} aria-label={`Jump to ${l === "#" ? "other" : l}`}
              className={`h-[1.05rem] w-5 text-[11px] font-bold leading-none ${present.has(l) ? "text-brand" : "text-muted/40"}`}>
              {l}
            </button>
          ))}
        </nav>
      )}
      {bubble && (
        <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 z-30 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-navy text-4xl font-extrabold text-[#f7e7a1] shadow-xl ring-1 ring-[#d4af37]">
          {bubble}
        </div>
      )}
    </div>
  );
}
