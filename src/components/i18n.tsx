"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LANGS, LOCALES, makeT, translateServerMessage, type Lang, type Messages } from "@/lib/i18n";

// The chosen language for the client pages' interactive parts (the booking steps).
const I18n = createContext<{ lang: Lang; messages: Messages }>({ lang: "en", messages: {} });

export function I18nProvider({ lang, messages, children }: { lang: Lang; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ lang, messages }), [lang, messages]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

/** t("Continue"), the language and its locale (for dates), and server messages translated. */
export function useT() {
  const { lang, messages } = useContext(I18n);
  return useMemo(() => {
    const t = makeT(messages);
    return { t, lang, locale: LOCALES[lang], serverMessage: (m: string) => translateServerMessage(t, m) };
  }, [lang, messages]);
}

/** A small language menu. Picking one reloads the page in it and remembers it for next time. */
export function LanguagePicker({ lang, label }: { lang: Lang; label: string }) {
  return (
    <label className="flex items-center justify-end gap-2 text-sm text-muted">
      <span aria-hidden>🌐</span>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={lang}
        onChange={(e) => {
          const next = e.target.value;
          document.cookie = `lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
          const url = new URL(window.location.href);
          url.searchParams.set("lang", next);
          window.location.assign(url.toString());
        }}
        className="rounded-full border border-line bg-surface px-3 py-1.5 font-semibold text-ink"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}
