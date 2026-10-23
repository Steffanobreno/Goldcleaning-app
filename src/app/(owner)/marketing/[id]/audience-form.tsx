"use client";
import { useEffect, useState, useTransition } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import type { Filters } from "@/lib/data/marketing";

// Step 2: who gets it. Every change recounts the clients right away.

export function AudienceForm({ initial, cities, count, save }: {
  initial: Filters;
  cities: { city: string; n: number }[];
  count: (f: Filters) => Promise<{ count: number; sample: string[] }>;
  save: (f: Filters) => Promise<void>;
}) {
  const [f, setF] = useState(initial);
  const [result, setResult] = useState<{ count: number; sample: string[] } | null>(null);
  const [saving, startSaving] = useTransition();
  const key = JSON.stringify(f);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => count(f).then((r) => live && setResult(r)), 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggleCity = (c: string) =>
    setF({ ...f, cities: f.cities.includes(c) ? f.cities.filter((x) => x !== c) : [...f.cities, c] });

  return (
    <div className="space-y-4">
      <Card className="space-y-1 border-brand bg-brand-soft text-center">
        <p className="text-3xl font-extrabold text-brand-strong" aria-live="polite">{result ? result.count : "…"}</p>
        <p className="text-sm font-semibold text-brand-strong">clients will get this email</p>
        {result && result.sample.length > 0 && (
          <p className="truncate text-xs text-muted">{result.sample.join(", ")}{result.count > result.sample.length ? "…" : ""}</p>
        )}
      </Card>
      <p className="px-1 text-xs text-muted">Always: clients with an email, active, who haven&apos;t unsubscribed.</p>

      <Card className="space-y-3">
        <Field label="Last visit">
          <Select value={f.lastVisit} onChange={(e) => setF({ ...f, lastVisit: e.target.value as Filters["lastVisit"] })}>
            <option value="any">Any time</option>
            <option value="over">More than … days ago (we miss you)</option>
            <option value="within">In the last … days</option>
            <option value="never">Never had a visit (new leads)</option>
          </Select>
        </Field>
        {(f.lastVisit === "over" || f.lastVisit === "within") && (
          <div className="flex flex-wrap items-center gap-2">
            {[30, 45, 60, 90, 180, 365].map((d) => (
              <button key={d} type="button" onClick={() => setF({ ...f, days: d })}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${f.days === d ? "border-brand bg-brand text-white" : "border-line"}`}>
                {d} days
              </button>
            ))}
            <label className="flex items-center gap-1 text-sm">
              <Input type="number" min={1} max={3650} value={f.days} onChange={(e) => setF({ ...f, days: Math.max(1, Number(e.target.value) || 1) })}
                className="w-24" aria-label="Days" /> days
            </label>
          </div>
        )}
        <Field label="Next visit">
          <Select value={f.upcoming} onChange={(e) => setF({ ...f, upcoming: e.target.value as Filters["upcoming"] })}>
            <option value="any">Doesn&apos;t matter</option>
            <option value="none">Nothing booked yet</option>
            <option value="has">Already booked</option>
          </Select>
        </Field>
        <Field label="Breed contains" hint="e.g. doodle, poodle, shih tzu">
          <Input value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} placeholder="Any breed" />
        </Field>
      </Card>

      {cities.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">City</span>
            {f.cities.length > 0 && <button type="button" onClick={() => setF({ ...f, cities: [] })} className="text-sm font-semibold text-brand">All cities</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <button key={c.city} type="button" onClick={() => toggleCity(c.city)} aria-pressed={f.cities.includes(c.city)}
                className={`rounded-full border px-3 py-1.5 text-sm ${f.cities.includes(c.city) ? "border-brand bg-brand text-white" : "border-line"}`}>
                {c.city} <span className="opacity-70">{c.n}</span>
              </button>
            ))}
          </div>
          {f.cities.length === 0 && <p className="text-xs text-muted">All cities. Tap to pick some.</p>}
        </Card>
      )}

      <Button type="button" className="w-full py-3.5 text-base" disabled={saving || result?.count === 0}
        onClick={() => startSaving(() => save(f))}>
        {saving ? "Saving…" : "Next: send →"}
      </Button>
    </div>
  );
}
