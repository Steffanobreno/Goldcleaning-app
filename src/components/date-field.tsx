"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Swipe } from "./swipe";

// A date field that opens our own month calendar (swipe sideways or use the arrows for other
// months, pick the year from the list) instead of the phone's plain date picker. The value
// still travels in a regular date input, so forms and tests work as before.

const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
const shiftMonth = (ym: string, n: number) => {
  const d = new Date(`${ym}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The last tap on the page (when and where), to tell a tap on a field's label from typing.
let lastTap = { at: -Infinity, on: null as EventTarget | null };
if (typeof window !== "undefined") {
  document.addEventListener("pointerdown", (e) => (lastTap = { at: performance.now(), on: e.target }), true);
}

export function DateField({ name, defaultValue, value, onChange, min, max, required, id, label, placeholder = "Pick a day", className = "" }: {
  name?: string; defaultValue?: string; value?: string; onChange?: (v: string) => void;
  min?: string; max?: string; required?: boolean; id?: string; placeholder?: string; className?: string;
  /** A name for the field when no <label> wraps it. */
  label?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const v = value ?? own;
  // The real input isn't controlled by React (a re-render would wipe what was just typed into
  // it); picking a day writes to it directly.
  const input = useRef<HTMLInputElement>(null);
  const set = (d: string, fromInput = false) => {
    if (!fromInput && input.current) input.current.value = d;
    if (value === undefined) setOwn(d);
    onChange?.(d);
  };
  useEffect(() => {
    if (value !== undefined && input.current && input.current.value !== value) input.current.value = value;
  }, [value]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  // Where the calendar opens: under the field, kept on screen.
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const toggle = () => {
    if (open) return setOpen(false);
    const r = box.current!.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
    setAt({ top: r.bottom + 4, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)) });
    setOpen(true);
  };
  // Tapping outside (or scrolling the page) closes it.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      {/* The real field (first, so a wrapping <label> names it): it carries the value in the form and
          can still be typed into; tapping the label focuses it, which opens the calendar. */}
      <input ref={input} type="date" name={name} defaultValue={v} onChange={(e) => set(e.target.value, true)} min={min} max={max} required={required}
        aria-label={label} tabIndex={-1} className="sr-only" onFocus={(e) => {
          // A tap on the label: show our calendar instead of the phone's picker. (Typing into the
          // field, as a keyboard or a test does, just types.)
          const label = e.currentTarget.closest("label");
          if (label && lastTap.on instanceof Node && label.contains(lastTap.on) && performance.now() - lastTap.at < 800) {
            e.currentTarget.blur();
            if (!open) toggle();
          }
        }} />
      <button type="button" id={id} aria-expanded={open} onClick={toggle}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-ink focus:border-brand focus:outline-none">
        <span className={`min-w-0 truncate whitespace-nowrap ${v ? "" : "text-muted"}`}>{v ? fmt(v, { month: "short", day: "numeric", year: "numeric" }) : placeholder}</span>
        <span aria-hidden className="text-brand">📅</span>
      </button>
      {/* The calendar is drawn outside the field's <label>, so tapping it never toggles the field. */}
      {open && at && createPortal(
        <div ref={pop} role="dialog" aria-label="Pick a day" style={{ top: at.top, left: at.left }}
          className="fixed z-50 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <MonthPicker value={v} min={min} max={max} onPick={(d) => {
            set(d);
            setOpen(false);
          }} />
        </div>,
        document.body,
      )}
    </div>
  );
}

/** A month of days: swipe or arrows for the next/previous month, a list to jump years. */
export function MonthPicker({ value, min, max, onPick, marked, start }: {
  value: string; min?: string; max?: string; onPick: (d: string) => void;
  /** More days shown as chosen (picking several days). */
  marked?: string[];
  /** The month to open on (yyyy-MM-dd), when nothing is chosen yet. */
  start?: string;
}) {
  const today = localToday();
  const [month, setMonth] = useState((value || start || today).slice(0, 7));
  const chosen = new Set(marked ?? []);
  const first = new Date(`${month}-01T12:00:00Z`);
  const lead = first.getUTCDay();
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const canPrev = !min || shiftMonth(month, -1) >= min.slice(0, 7);
  const canNext = !max || shiftMonth(month, 1) <= max.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const fromYear = min ? Number(min.slice(0, 4)) : year - 30;
  const toYear = max ? Number(max.slice(0, 4)) : year + 5;
  const arrow = "flex h-9 w-9 items-center justify-center rounded-full text-xl text-brand disabled:opacity-30";
  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <button type="button" className={arrow} aria-label="Previous month" disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <span className="flex flex-1 items-center justify-center gap-1 font-bold">
          {fmt(`${month}-01`, { month: "long" })}
          <select aria-label="Year" value={year} onChange={(e) => setMonth(`${e.target.value}${month.slice(4)}`)}
            className="rounded-lg bg-transparent py-1 font-bold text-ink">
            {Array.from({ length: Math.max(1, toYear - fromYear + 1) }, (_, i) => fromYear + i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </span>
        <button type="button" className={arrow} aria-label="Next month" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <Swipe className="grid grid-cols-7 gap-y-1 text-center" label={fmt(`${month}-01`, { month: "long", year: "numeric" })}
        prev={canPrev ? () => setMonth(shiftMonth(month, -1)) : null} next={canNext ? () => setMonth(shiftMonth(month, 1)) : null}>
        {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <span key={i} aria-hidden className="pb-1 text-xs font-semibold text-muted">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {days.map((d) => {
          const off = (!!min && d < min) || (!!max && d > max);
          return (
            <button key={d} type="button" disabled={off} onClick={() => onPick(d)} aria-pressed={d === value || chosen.has(d)}
              aria-label={fmt(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold disabled:opacity-30 ${
                d === value || chosen.has(d) ? "bg-brand text-white" : d === today ? "ring-2 ring-brand text-brand" : "hover:bg-brand-soft"}`}>
              {Number(d.slice(8))}
            </button>
          );
        })}
      </Swipe>
      <div className="mt-2 flex justify-between text-sm font-semibold">
        <button type="button" className="px-2 py-1 text-brand" onClick={() => {
          setMonth(today.slice(0, 7));
          if ((!min || today >= min) && (!max || today <= max)) onPick(today);
        }}>Today</button>
      </div>
    </div>
  );
}
