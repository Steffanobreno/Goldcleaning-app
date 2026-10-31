"use client";
import { useState } from "react";

/** The QR code poster: clients scan it to open the booking page. Share, save or print it. */
export function QrCard({ svg, name, url }: { svg: string; name: string; url: string }) {
  const [busy, setBusy] = useState(false);
  // On a phone the share sheet takes the picture; elsewhere it opens the image to save.
  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch("/settings/booking/qr")).blob();
      const file = new File([blob], "booking-qr-code.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
      else window.open("/settings/booking/qr", "_blank");
    } catch {
      /* the person closed the share sheet */
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div id="qr-poster" className="mx-auto max-w-xs rounded-3xl bg-navy p-5 text-center text-white">
        <p className="text-2xl font-extrabold tracking-tight">BOOK NOW</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- small logo */}
          <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-navy object-contain" />
          <span className="font-bold">{name}</span>
        </div>
        <div className="mt-4 rounded-2xl bg-white p-3" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 text-sm text-white/80">Scan with your phone camera</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={share} disabled={busy}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-navy disabled:opacity-50">
          {busy ? "…" : "Share"}
        </button>
        <a href="/settings/booking/qr?download" className="rounded-xl border border-line bg-surface px-3 py-2.5 text-center text-sm font-semibold text-navy">
          Save image
        </a>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-navy">
          Print
        </button>
      </div>
    </div>
  );
}
