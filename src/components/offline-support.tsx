"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Keeps the app usable on the road with a weak or no signal (see public/sw.js): turns on the
// service worker, says when the signal drops, loads the live page when the network is back
// after a saved copy, and saves the day's visits (and their code) from Today ahead of time.

type Notice = { offline: boolean; at: string | null } | null;

export function OfflineSupport() {
  const router = useRouter();
  const path = usePathname();
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1").catch(() => null);
    let savedCopy = false;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; url?: string; at?: string | null; offline?: boolean };
      if (m?.url !== location.href) return;
      if (m.type === "saved-copy") {
        savedCopy = true;
        document.getElementById("gold-saved-copy")?.remove();
        setNotice({ offline: !!m.offline, at: m.at ?? null });
      }
      // The network caught up after a saved copy was shown: load the live page.
      if (m.type === "fresh" && (savedCopy || document.getElementById("gold-saved-copy"))) location.reload();
    };
    const onOffline = () => setNotice((n) => n ?? { offline: true, at: null });
    const onOnline = () => {
      setNotice(null);
      if (savedCopy || document.getElementById("gold-saved-copy")) location.reload();
      else router.refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  // On Today, save each visit of the day for the road (once the screen has settled).
  useEffect(() => {
    if (path !== "/today" || !navigator.onLine || !("serviceWorker" in navigator)) return;
    const t = setTimeout(async () => {
      if (!navigator.serviceWorker.controller) return;
      const links = [...new Set([...document.querySelectorAll<HTMLAnchorElement>('a[href^="/appointments/"]')]
        .map((a) => a.getAttribute("href")!)
        .filter((h) => /^\/appointments\/[0-9a-f-]{36}$/.test(h)))].slice(0, 15);
      const files = new Set<string>();
      for (const href of links) {
        const res = await fetch(href, { headers: { "x-gold-warm": "1" }, credentials: "same-origin" }).catch(() => null);
        const html = res?.ok ? await res.text() : "";
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+/g)) files.add(m[0]);
      }
      // The screens' code too, so a saved screen also works (buttons, menus) without signal.
      for (const f of files) await fetch(f).catch(() => null);
    }, 3000);
    return () => clearTimeout(t);
  }, [path]);

  if (!notice) return null;
  const when = notice.at ? new Date(notice.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[env(safe-area-inset-top)]">
      <p className="mt-2 rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-[#f7e7a1] shadow-lg ring-1 ring-gold">
        {notice.offline ? "📴 Offline" : "📶 Weak signal"} · {when ? `saved copy from ${when}` : "showing what's saved"}
        {!notice.offline && " · updating…"}
      </p>
    </div>
  );
}
