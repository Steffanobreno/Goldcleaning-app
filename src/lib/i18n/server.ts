import "server-only";
import { cookies, headers } from "next/headers";
import { fromAcceptLanguage, isLang, makeT, type Lang } from ".";
import { MESSAGES } from "./messages";

/**
 * The client's language: ?lang= on the page, then the one they picked before (cookie), then the
 * page they came from (inside the website's frame cookies may be blocked), then the phone's.
 */
export async function getLang(param?: unknown): Promise<Lang> {
  if (isLang(param)) return param;
  const jar = await cookies();
  const saved = jar.get("lang")?.value;
  if (isLang(saved)) return saved;
  const h = await headers();
  const fromPage = (() => {
    try {
      return new URL(h.get("referer") ?? "").searchParams.get("lang");
    } catch {
      return null;
    }
  })();
  if (isLang(fromPage)) return fromPage;
  return fromAcceptLanguage(h.get("accept-language"));
}

/** The language, its phrases (to hand to the page's client parts) and t() for the server parts. */
export async function getI18n(param?: unknown) {
  const lang = await getLang(param);
  const messages = MESSAGES[lang];
  return { lang, messages, t: makeT(messages) };
}
