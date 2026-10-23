"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { Close, Plus } from "@/components/icons";
import { minutesLabel, money } from "@/lib/format";
import { saveServicesAction, type ServiceLine } from "../../actions";

type Line = { key: string; id?: string; serviceId: string; name: string; priceCents: number; minutes: number };
type Pet = { appointmentPetId: string; name: string; size: string | null; lines: Omit<Line, "key">[] };
type CatalogItem = { id: string; name: string; kind: "service" | "addon"; size: string | null; priceCents: number; minutes: number };

let nextKey = 0;
const STEP = 15;

// Price and time of each service on one visit. Time changes move the visit's end.
export function ServicesEditor({
  appointmentId, startIso, timezone, pets, catalog,
}: { appointmentId: string; startIso: string; timezone: string; pets: Pet[]; catalog: CatalogItem[] }) {
  const router = useRouter();
  const [state, setState] = useState(() =>
    Object.fromEntries(pets.map((p) => [p.appointmentPetId, p.lines.map((l) => ({ ...l, key: `k${nextKey++}` }))])) as Record<string, Line[]>,
  );
  const [result, setResult] = useState<{ error?: string; warning?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const all = Object.values(state).flat();
  const totalMin = all.reduce((s, l) => s + l.minutes, 0);
  const total = all.reduce((s, l) => s + l.priceCents, 0);
  const start = new Date(startIso);
  const end = new Date(start.getTime() + Math.max(totalMin, 15) * 60_000);
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone });
  const update = (petId: string, key: string, patch: Partial<Line>) =>
    setState({ ...state, [petId]: state[petId].map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  const save = () =>
    startTransition(async () => {
      const lines: ServiceLine[] = Object.entries(state).flatMap(([appointmentPetId, ls]) =>
        ls.map((l) => ({ id: l.id, appointmentPetId, serviceId: l.serviceId, priceCents: l.priceCents, minutes: l.minutes })),
      );
      const res = await saveServicesAction(appointmentId, lines);
      if (res?.error) return setResult(res);
      if (res?.warning) {
        setResult(res);
        router.refresh();
        return;
      }
      router.push(`/appointments/${appointmentId}`);
    });

  return (
    <div className="space-y-5">
      {pets.map((p) => {
        const lines = state[p.appointmentPetId];
        const options = catalog.filter((c) => !c.size || !p.size || c.size === p.size);
        return (
          <section key={p.appointmentPetId} className="space-y-2">
            <h2 className="section-label">{p.name}</h2>
            {lines.map((l) => (
              <div key={l.key} className="card divide-y divide-line">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 font-semibold">{l.name}</span>
                  <button type="button" aria-label={`Remove ${l.name}`} disabled={lines.length === 1}
                    onClick={() => setState({ ...state, [p.appointmentPetId]: lines.filter((x) => x.key !== l.key) })}
                    className="rounded-full border-2 border-danger p-0.5 text-danger disabled:opacity-30">
                    <Close size={14} strokeWidth={3} />
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-muted">Price</span>
                  <span className="flex items-center gap-1">
                    $
                    <input inputMode="decimal" aria-label={`Price of ${l.name}`} className="w-24 rounded-lg border border-line px-2 py-1.5 text-right"
                      defaultValue={(l.priceCents / 100).toString()}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value.replace(/[$,]/g, "")) * 100);
                        if (Number.isFinite(n) && n >= 0) update(p.appointmentPetId, l.key, { priceCents: n });
                      }} />
                  </span>
                </label>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-muted">Time</span>
                  <span className="flex items-center gap-3">
                    <button type="button" aria-label={`Less time for ${l.name}`} className="stepper"
                      onClick={() => update(p.appointmentPetId, l.key, { minutes: Math.max(0, l.minutes - STEP) })}>−</button>
                    <span className="w-20 text-center font-semibold tabular-nums" aria-live="polite">{l.minutes} min</span>
                    <button type="button" aria-label={`More time for ${l.name}`} className="stepper"
                      onClick={() => update(p.appointmentPetId, l.key, { minutes: Math.min(720, l.minutes + STEP) })}>+</button>
                  </span>
                </div>
              </div>
            ))}
            <label className="card flex items-center gap-3 px-4 py-3 text-brand">
              <Plus size={18} />
              <select aria-label={`Add a service for ${p.name}`} className="w-0 min-w-0 flex-1 truncate bg-transparent font-semibold outline-none" value=""
                onChange={(e) => {
                  const c = catalog.find((x) => x.id === e.target.value);
                  if (!c) return;
                  setState({ ...state, [p.appointmentPetId]: [...lines, { key: `k${nextKey++}`, serviceId: c.id, name: c.name, priceCents: c.priceCents, minutes: c.minutes }] });
                }}>
                <option value="">Add a service</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {money(c.priceCents)}</option>
                ))}
              </select>
            </label>
          </section>
        );
      })}

      <div className="card space-y-1 px-4 py-3">
        <p className="flex justify-between"><span className="text-muted">Total time</span><span className="font-semibold">{minutesLabel(totalMin)}</span></p>
        <p className="flex justify-between"><span className="text-muted">Visit</span><span className="font-semibold">{time(start)} – {time(end)}</span></p>
        <p className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(total)}</span></p>
      </div>
      {result?.error && <Notice kind="error">{result.error}</Notice>}
      {result?.warning && <Notice kind="warn">{result.warning}</Notice>}
      <Button className="w-full py-3.5 text-base" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}
