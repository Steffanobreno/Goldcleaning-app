"use client";
import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { minutesLabel, money, sizeLabel } from "@/lib/format";
import { Dog } from "@/components/icons";
import type { FormState } from "./actions";

type Pet = { id: string; name: string; breed: string | null; size_class: string | null; vaccineAlert?: string | null };
type Service = {
  id: string;
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  duration_min: number;
  price_cents: number;
};

export function BookingForm({
  action,
  pets,
  services,
  defaultDate,
  defaultTime,
  groomers = [],
  defaultGroomer,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  pets: Pet[];
  services: Service[];
  defaultDate: string;
  defaultTime: string;
  groomers?: { id: string; name: string; color: string }[]; // shown when there's more than one
  defaultGroomer?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [chosen, setChosen] = useState<Record<string, boolean>>(() =>
    pets.length === 1 ? { [pets[0].id]: true } : {},
  );
  const [main, setMain] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Record<string, string[]>>({});

  const mains = services.filter((s) => s.kind === "service");
  const addons = services.filter((s) => s.kind === "addon");
  const byId = new Map(services.map((s) => [s.id, s]));

  let minutes = 0;
  let cents = 0;
  for (const pet of pets) {
    if (!chosen[pet.id]) continue;
    for (const id of [main[pet.id], ...(extras[pet.id] ?? [])]) {
      const s = id ? byId.get(id) : undefined;
      if (s) {
        minutes += s.duration_min;
        cents += s.price_cents;
      }
    }
  }

  const [extraMin, setExtraMin] = useState(0); // the groomer's adjustment to the estimate
  const visitMin = Math.max(minutes + extraMin, 15);

  return (
    <ActionForm action={formAction} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}

      <h2 className="section-label">Select pet</h2>
      {pets.map((pet) => {
        const on = !!chosen[pet.id];
        // Services for this pet's size first, then the rest.
        const fits = mains.filter((s) => !s.size_class || s.size_class === pet.size_class);
        const others = mains.filter((s) => s.size_class && s.size_class !== pet.size_class);
        return (
          <fieldset key={pet.id} className={`card overflow-hidden ${on ? "border-2 border-brand" : ""}`}>
            <legend className="sr-only">{pet.name}</legend>
            <label className="flex cursor-pointer items-center gap-4 px-4 py-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bg"><Dog size={26} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{pet.name}</span>
                <span className="block truncate text-sm text-muted">{[pet.breed, sizeLabel(pet.size_class)].filter(Boolean).join(" · ")}</span>
                {pet.vaccineAlert && <span className="block text-xs font-semibold text-danger">💉 {pet.vaccineAlert}</span>}
              </span>
              <input
                type="checkbox"
                name="pet"
                value={pet.id}
                checked={on}
                onChange={(e) => setChosen({ ...chosen, [pet.id]: e.target.checked })}
                className="h-6 w-6 accent-[var(--color-brand)]"
              />
            </label>
            {on && (
              <div className="space-y-3 border-t border-line px-4 py-4">
                <Field label="Service">
                  <Select
                    name={`svc:${pet.id}`}
                    required
                    value={main[pet.id] ?? ""}
                    onChange={(e) => setMain({ ...main, [pet.id]: e.target.value })}
                  >
                    <option value="" disabled>
                      Choose a service
                    </option>
                    <optgroup label={pet.size_class ? `For ${sizeLabel(pet.size_class)}` : "Services"}>
                      {fits.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {money(s.price_cents)} · {minutesLabel(s.duration_min)}
                        </option>
                      ))}
                    </optgroup>
                    {others.length > 0 && (
                      <optgroup label="Other sizes">
                        {others.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {money(s.price_cents)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                </Field>
                {addons.length > 0 && (
                  <details className="rounded-xl border border-line px-3 py-2" open={(extras[pet.id]?.length ?? 0) > 0}>
                    <summary className="cursor-pointer text-sm font-semibold text-brand">
                      Add-ons{extras[pet.id]?.length ? ` (${extras[pet.id].length})` : ""}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {addons.map((a) => {
                        const list = extras[pet.id] ?? [];
                        return (
                          <li key={a.id}>
                            <label className="flex items-center gap-3 py-1.5 text-sm">
                              <input
                                type="checkbox"
                                name={`svc:${pet.id}`}
                                value={a.id}
                                checked={list.includes(a.id)}
                                onChange={(e) =>
                                  setExtras({
                                    ...extras,
                                    [pet.id]: e.target.checked ? [...list, a.id] : list.filter((x) => x !== a.id),
                                  })
                                }
                                className="h-5 w-5 accent-[var(--color-brand)]"
                              />
                              <span className="flex-1">{a.name}</span>
                              <span className="text-muted">{money(a.price_cents)}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </fieldset>
        );
      })}

      <h2 className="section-label pt-2">When</h2>
      <div className="card divide-y divide-line">
        {groomers.length > 1 && (
          <div className="px-4 py-3">
            <span className="mb-2 block text-sm font-medium">Groomer</span>
            <div className="flex flex-wrap gap-2">
              {groomers.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="radio" name="staff_id" value={g.id} defaultChecked={g.id === (defaultGroomer ?? groomers[0].id)} className="sr-only" />
                  <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <Field label="Date">
            <Input type="date" name="date" defaultValue={defaultDate} required />
          </Field>
          <Field label="Start time">
            <Input type="time" name="time" defaultValue={defaultTime} step={900} required />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block font-medium">Time estimate</span>
            <span className="block text-xs text-muted">From the services{extraMin ? `, ${extraMin > 0 ? "+" : ""}${extraMin} min` : ""}</span>
          </span>
          <span className="flex items-center gap-3">
            <button type="button" className="stepper" aria-label="Less time" onClick={() => setExtraMin(Math.max(extraMin - 15, 15 - minutes))}>−</button>
            <span className="w-16 text-center font-semibold tabular-nums" aria-live="polite">{minutes > 0 ? `${visitMin} min` : "—"}</span>
            <button type="button" className="stepper" aria-label="More time" onClick={() => setExtraMin(extraMin + 15)}>+</button>
          </span>
          <input type="hidden" name="duration" value={minutes > 0 ? visitMin : ""} />
        </div>
      </div>
      <Field label="Notes for this visit (optional)">
        <Textarea name="notes" placeholder="Private notes for this visit" />
      </Field>

      <div className="card flex items-center justify-between px-4 py-3">
        <span className="text-muted">{minutes > 0 ? minutesLabel(visitMin) : "No services yet"}</span>
        <span className="text-xl font-bold">{money(cents)}</span>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-[var(--color-brand)]" />
        Send the confirmation to the client (text and email)
      </label>

      {state?.warning && (
        <div className="space-y-2">
          <Notice kind="warn">{state.warning}</Notice>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="override" className="h-5 w-5" />
            Book anyway
          </label>
        </div>
      )}

      <Button type="submit" className="w-full rounded-2xl py-3.5 text-base" disabled={pending}>
        {pending ? "Booking…" : "Book appointment"}
      </Button>
    </ActionForm>
  );
}
