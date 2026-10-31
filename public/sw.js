// Service worker for the owner app.
// 1. Push notifications (open the right screen when tapped).
// 2. Works with a weak or no signal on the road: the team's screens (Today, Calendar, visits,
//    clients…) are kept as they were last seen. A screen comes from the network when it answers
//    quickly; otherwise the saved copy shows at once and the page refreshes itself when the
//    network catches up. Offline, the saved copy shows with a notice. Nothing is kept for the
//    client pages, logins or anything sent (payments, bookings always need the network).

const PAGES = "gold-pages-v1";
const STATIC = "gold-static-v1";
const OWNER = /^\/(today|calendar|appointments|clients|requests|waitlist|receipts|reports)(\/|$)/;
const WAIT_MS = 2500; // how long to wait for the network before showing the saved copy
const MAX_PAGES = 80;
// In development (sw.js?dev=1) built files keep their names while they change: never keep them.
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gold-") && k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const tell = async (message) => {
  for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage(message);
};

async function keep(request, response) {
  const cache = await caches.open(PAGES);
  await cache.put(request.url, response);
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(old);
}

// The saved copy says so at the top (written into the page, so it shows even before the app's
// code has started).
async function withNotice(saved, offline) {
  const at = saved.headers.get("date");
  const when = at ? new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  const text = `${offline ? "📴 Offline" : "📶 Weak signal"} · ${when ? `saved copy from ${when}` : "showing what's saved"}${offline ? "" : " · updating…"}`;
  const banner = `<div id="gold-saved-copy" role="status" style="position:fixed;left:0;right:0;top:0;z-index:60;display:flex;justify-content:center;padding:calc(env(safe-area-inset-top) + 8px) 16px 0;pointer-events:none">` +
    `<p style="margin:0;border-radius:999px;background:#0b1f3b;color:#f7e7a1;font:700 12px system-ui;padding:6px 16px;box-shadow:0 4px 12px rgb(0 0 0/.25);outline:1px solid #c6a45e">${text}</p></div>`;
  const html = (await saved.text()).replace(/<body([^>]*)>/, (m) => m + banner);
  const headers = new Headers(saved.headers);
  headers.delete("content-length");
  return new Response(html, { status: 200, headers });
}

const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Gold Cleaning</title><body style="font-family:system-ui;background:#f5f4f0;color:#132039;padding:2rem;text-align:center">
<h1 style="font-size:1.4rem">You're offline</h1><p>This screen wasn't saved on this phone yet.</p>
<p>Open Today once with signal and the day's visits are kept for the road.</p>
<p><a href="/today" style="color:#0b1f3b;font-weight:700">Try Today</a></p></body>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Logging out (or in) forgets every saved screen.
  if (req.mode === "navigate" && url.pathname === "/login") {
    event.waitUntil(caches.delete(PAGES));
    return;
  }

  // Built files never change (their names do): from the phone first.
  if (url.pathname.startsWith("/_next/static/") && !DEV) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  const warm = req.headers.get("x-gold-warm") === "1";
  if (!OWNER.test(url.pathname) || (req.mode !== "navigate" && !warm)) return;

  event.respondWith((async () => {
    // The page shows as it arrives; the copy is saved alongside, without holding it up.
    const network = fetch(req).then((res) => {
      if (res.ok && (res.headers.get("content-type") || "").includes("text/html") && !res.redirected) {
        event.waitUntil(keep(req, res.clone()).catch(() => null));
      }
      return res;
    });
    if (warm) return network;
    const saved = await caches.match(req.url, { ignoreVary: true });
    if (!saved) {
      return network.catch(() => new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }
    // Network first, but don't keep you waiting: after a moment, the saved copy.
    let late = false;
    const answer = await Promise.race([
      network.then((res) => ({ res }), () => ({ offline: true })),
      new Promise((r) => setTimeout(() => r({ slow: true }), WAIT_MS)),
    ]);
    if (answer.res) return answer.res;
    late = !!answer.slow;
    if (late) {
      // When the network answers after all, the open page refreshes itself.
      event.waitUntil(network.then(() => tell({ type: "fresh", url: req.url }), () => tell({ type: "offline" })));
    }
    // Also tell the page (the app's own notice, once its code has started).
    event.waitUntil(new Promise((r) => setTimeout(r, 400)).then(() => tell({ type: "saved-copy", url: req.url, at: saved.headers.get("date"), offline: !late })));
    return withNotice(saved, !late);
  })());
});

// ---------- Push notifications ----------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Gold Cleaning", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Gold Cleaning", {
      body: data.body || "",
      icon: "/apple-icon.png",
      badge: "/apple-icon.png",
      data: { url: data.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/today", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
