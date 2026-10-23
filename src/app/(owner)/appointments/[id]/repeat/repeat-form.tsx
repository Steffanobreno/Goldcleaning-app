"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { MAX_VISITS, repeatDates, ruleLabel, type RepeatRule } from "@/lib/repeat";
import type { RepeatState } from "../../repeat-actions";

// Repeat type (day / week / month), every N, and when it ends (after N times or on a date),
// with the dates listed live below. Saving books them.

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function RepeatForm({ appointmentId, clientId, first, time, initial, repeating, save, stop }: {
  appointmentId: string;
  clientId: string;
  first: string; // this visit's date
  time: string; // "10:00 AM"
  initial: RepeatRule;
  repeating: boolean;
  save: (state: RepeatState, form: FormData) => Promise<RepeatState>;
  stop: (state: RepeatState) => Promise<RepeatState>;
}) {
  const [state, saveAction, saving] = useActionState(save, undefined);
  const [stopState, stopAction, stopping] = useActionState(stop, undefined);
  const [freq, setFreq] = useState(initial.freq);
  const [every, setEvery] = useState(initial.every);
  const [ends, setEnds] = useState<"count" | "date">(initial.until ? "date" : "count");
  const [count, setCount] = useState(initial.count ?? 10);
  const [until, setUntil] = useState(initial.until ?? "");
  const rule: RepeatRule = { freq, every, count: ends === "count" ? count : null, until: ends === "date" ? until || null : null };
  const dates = ends === "date" && !until ? [first] : repeatDates(first, rule);
  const result = state?.done ?? stopState?.done;

  if (result) {
    return (
      <div className="space-y-4">
        <Notice kind="success">
          {result.stopped ? "This visit no longer repeats. The later ones were removed."
            : `Booked ${result.created} more visit${result.created === 1 ? "" : "s"}: ${ruleLabel(first, rule).toLowerCase()}.`}
        </Notice>
        {result.skipped.length > 0 && (
          <Card className="space-y-2">
            <h2 className="font-bold">Not booked: that time is taken</h2>
            <ul className="divide-y divide-line">
              {result.skipped.map((s) => (
                <li key={s.date} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-semibold">{fmt(s.date)}</span> <span className="text-muted">· {s.reason}</span></span>
                  <Link href={`/appointments/new?client=${clientId}&date=${s.date}`} className="shrink-0 font-semibold text-brand">Book</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Link href={`/appointments/${appointmentId}`} className="block rounded-xl bg-brand py-3.5 text-center font-semibold text-on-brand">Done</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ActionForm action={saveAction} className="space-y-4">
        {state?.error && <Notice kind="error">{state.error}</Notice>}
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeat every">
              <Select name="every" value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label={"\u00a0"}>
              <Select name="freq" aria-label="Repeat type" value={freq} onChange={(e) => setFreq(e.target.value as RepeatRule["freq"])}>
                <option value="day">{every === 1 ? "day" : "days"}</option>
                <option value="week">{every === 1 ? "week" : "weeks"}</option>
                <option value="month">{every === 1 ? "month" : "months"}</option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Quick picks">
            {([[1, "week", "Every week"], [2, "week", "Every 2 weeks"], [3, "week", "Every 3 weeks"], [4, "week", "Every 4 weeks"], [1, "month", "Every month"]] as const).map(([n, f, label]) => (
              <button key={label} type="button" onClick={() => { setEvery(n); setFreq(f); }}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${every === n && freq === f ? "border-brand bg-brand text-white" : "border-line"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">Starts with this visit, {fmt(first)} at {time}. Same pets, services and time.</p>
        </Card>
        <Card className="space-y-3">
          <Field label="Ends">
            <Select name="ends" value={ends} onChange={(e) => setEnds(e.target.value as "count" | "date")}>
              <option value="count">After a number of visits</option>
              <option value="date">On a date</option>
            </Select>
          </Field>
          {ends === "count" ? (
            <div className="flex items-center justify-center gap-4">
              <button type="button" aria-label="Fewer" onClick={() => setCount(Math.max(2, count - 1))} className="h-10 w-10 rounded-full border border-line text-xl">−</button>
              <label className="text-center">
                <span className="text-sm text-muted">After</span>{" "}
                <input name="count" inputMode="numeric" value={count} aria-label="Number of visits"
                  onChange={(e) => setCount(Math.min(MAX_VISITS, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)))}
                  className="w-16 border-b-2 border-brand bg-transparent text-center text-xl font-bold outline-none" />{" "}
                <span className="text-sm text-muted">times</span>
              </label>
              <button type="button" aria-label="More" onClick={() => setCount(Math.min(MAX_VISITS, count + 1))} className="h-10 w-10 rounded-full border border-line text-xl">+</button>
            </div>
          ) : (
            <Field label="Last day">
              <Input type="date" name="until" min={first} value={until} onChange={(e) => setUntil(e.target.value)} required />
            </Field>
          )}
        </Card>

        <Card className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">{dates.length} visit{dates.length === 1 ? "" : "s"}</h2>
            <span className="text-sm text-muted">{ruleLabel(first, rule)}</span>
          </div>
          <ol className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
            {dates.map((d, i) => (
              <li key={d} className="flex justify-between py-1.5">
                <span>{i + 1}. {fmt(d)}</span>
                <span className="text-muted">{i === 0 ? "this visit" : time}</span>
              </li>
            ))}
          </ol>
        </Card>
        {repeating && (
          <Notice kind="warn">Saving replaces the later visits of this repeat that the client hasn&apos;t confirmed yet. Confirmed, checked-in and paid visits stay.</Notice>
        )}
        <Button type="submit" disabled={saving || dates.length < 2} className="w-full py-3.5 text-base">
          {saving ? "Booking…" : `Save and book ${Math.max(dates.length - 1, 0)} more`}
        </Button>
      </ActionForm>
      {repeating && (
        <form action={stopAction}>
          <button type="submit" disabled={stopping}
            className="w-full rounded-xl border border-line bg-surface py-3 font-semibold text-danger hover:bg-danger-soft">
            {stopping ? "Removing…" : "Stop repeating (remove the later visits)"}
          </button>
        </form>
      )}
    </div>
  );
}
