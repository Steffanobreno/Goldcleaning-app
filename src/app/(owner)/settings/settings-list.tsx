"use client";
import Link from "next/link";
import { useState } from "react";

export type SettingsGroup = { title: string; links: { href: string; title: string; text: string }[] };

/** The settings menu in groups, with a search box that narrows it as you type. */
export function SettingsList({ groups }: { groups: SettingsGroup[] }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = groups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) => words.every((w) => `${g.title} ${l.title} ${l.text}`.toLowerCase().includes(w))),
    }))
    .filter((g) => g.links.length);
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Search settings</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search settings"
          className="block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </label>
      {shown.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="section-label">{g.title}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {g.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <div className="flex-1">
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-sm text-muted">{l.text}</div>
                  </div>
                  <span aria-hidden className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!shown.length && <p className="py-6 text-center text-sm text-muted">Nothing matches “{q}”.</p>}
    </div>
  );
}
