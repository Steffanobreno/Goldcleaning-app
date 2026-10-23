"use client";
import { MAX_EXTRA_QTY, type CatalogExtra } from "@/lib/pricing";
import { money } from "@/lib/format";

const ICONS: Record<string, string> = {
  cabinet: "🗄️",
  garage: "🏚️",
  "garage-floor": "🚗",
  oven: "🔥",
  fridge: "🧊",
  baseboard: "📏",
  patio: "🌿",
  door: "🚪",
  window: "🪟",
  linens: "🛏️",
  dishes: "🍽️",
  blinds: "🪟",
};

// Extras as a grid of tiles. An on/off extra toggles on tap; a per-unit one shows − / count / +.
export function ExtrasGrid({
  extras,
  qty,
  onChange,
}: {
  extras: CatalogExtra[];
  qty: Record<string, number>;
  onChange: (id: string, n: number) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {extras.map((x) => {
        const n = qty[x.id] ?? 0;
        const on = n > 0;
        const tile = `flex h-full w-full flex-col items-center justify-start gap-1 rounded-2xl border px-1.5 py-3 text-center text-[13px] leading-tight transition ${
          on ? "border-gold bg-gold-soft" : "border-line bg-surface"
        }`;
        const body = (
          <>
            <span aria-hidden className="text-2xl">{ICONS[x.icon ?? ""] ?? "✨"}</span>
            <span>{x.name}</span>
            {!(x.perUnit && on) && <span className="text-muted">{money(x.unitCents).replace(/\.00$/, "")}</span>}
          </>
        );
        return (
          <li key={x.id}>
            {x.perUnit && on ? (
              <div className={tile}>
                {body}
                <span className="mt-1 flex items-center gap-2">
                  <button type="button" aria-label={`Fewer ${x.name}`} onClick={() => onChange(x.id, n - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-navy font-bold text-white">−</button>
                  <span className="w-5 font-bold tabular-nums" aria-live="polite">{n}</span>
                  <button type="button" aria-label={`More ${x.name}`} onClick={() => onChange(x.id, Math.min(n + 1, MAX_EXTRA_QTY))}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-navy font-bold text-white">+</button>
                </span>
              </div>
            ) : (
              <button type="button" aria-pressed={on} onClick={() => onChange(x.id, on ? 0 : 1)} className={tile}>
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
