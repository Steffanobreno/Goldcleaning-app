// The pages clients see (booking, their appointment link, receipts) in the languages most
// spoken in the US and the Bay Area. English is the source: every phrase is written in English
// in the code and looked up in the other languages' lists; a phrase that isn't translated yet
// just shows in English. Owner screens stay in English.

export const LANGS = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "zh", name: "中文" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "pt", name: "Português" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];
export type Messages = Record<string, string>;

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

/** For dates and times (Intl). */
export const LOCALES: Record<Lang, string> = {
  en: "en-US", es: "es-US", zh: "zh-CN", vi: "vi-VN", pt: "pt-BR",
};

/** The best language for an Accept-Language header ("es-MX,es;q=0.9,en;q=0.8" → es). */
export function fromAcceptLanguage(header: string | null): Lang {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().split(";")[0].toLowerCase();
    const base = code.split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

/** Fills "{name}" placeholders. */
const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

export type T = (english: string, vars?: Record<string, string | number>) => string;

/** t(english phrase, values) in the chosen language, or in English when missing. */
export const makeT = (messages: Messages): T => (english, vars) => fill(messages[english] ?? english, vars);

// Messages the server sends back with a number or a name in them, matched by shape so the page
// can show them translated too.
const SHAPES: [RegExp, string][] = [
  [/^Please call or text us at (.+) to book your next cleaning\.$/, "Please call or text us at {phone} to book your next cleaning."],
  [/^Please call or text us at (.+) and we'll find you a time\.$/, "Please call or text us at {phone} and we'll find you a time."],
  [/^No open times right now\. Please call or text us at (.+)\.$/, "No open times right now. Please call or text us at {phone}."],
  [/^Our prices were just updated\. Your new total is (.+)\. Please check it and press Request booking again\.$/, "Our prices were just updated. Your new total is {total}. Please check it and press Request booking again."],
];
const SHAPE_VARS = ["phone", "phone", "phone", "total"];

/** A message from the server (English), in the chosen language when we know it. */
export function translateServerMessage(t: T, message: string) {
  // "That code has expired. Remove the code or try another one." = a code message plus a hint.
  const hint = " Remove the code or try another one.";
  if (message.endsWith(hint)) return `${t(message.slice(0, -hint.length))} ${t("Remove the code or try another one.")}`;
  for (const [i, [re, english]] of SHAPES.entries()) {
    const m = message.match(re);
    if (m) return t(english, { [SHAPE_VARS[i]]: m[1] });
  }
  return t(message);
}
