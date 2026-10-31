"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockAction } from "@/app/(owner)/settings/account/actions";

const KEY = "gold:unlocked-at";
const AWAY_MS = 5 * 60_000;

/**
 * The app lock: when the person has a PIN, the app asks for it when opened again on this
 * phone or after 5 minutes in the background. It keeps others out of the app on a shared or
 * lost phone; the login itself stays the real protection.
 */
export function AppLock() {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      let at = 0;
      try { at = Number(sessionStorage.getItem(KEY) ?? 0); } catch {}
      if (!at || Date.now() - at > AWAY_MS) setLocked(true);
    };
    const away = () => {
      if (document.visibilityState === "visible") check();
      else try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
    };
    check();
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, []);

  if (!locked) return null;
  const submit = (value: string) => start(async () => {
    const r = await unlockAction(value);
    if (r === "ok") {
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
      setLocked(false);
      setPin("");
      setError(null);
    } else if (r === "logged-out") {
      router.replace("/login");
    } else {
      setPin("");
      setError("Wrong PIN. After 5 wrong tries you'll need to log in again.");
    }
  });
  const press = (d: string) => {
    if (pending) return;
    setPin((pin + d).slice(0, 6));
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="App locked" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-navy-deep px-6 text-white">
      <p className="text-xl font-bold">Enter your PIN</p>
      <form onSubmit={(e) => { e.preventDefault(); if (pin.length >= 4) submit(pin); }} className="flex flex-col items-center gap-4">
        <input type="password" inputMode="numeric" autoComplete="off" value={pin} aria-label="PIN" maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-40 rounded-xl bg-white/10 px-3 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-gold" />
        {error && <p role="alert" className="max-w-xs text-center text-sm text-red-200">{error}</p>}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} className="h-16 w-16 rounded-full bg-white/10 text-2xl font-semibold">{d}</button>
          ))}
          <button type="button" onClick={() => setPin(pin.slice(0, -1))} className="h-16 w-16 rounded-full text-sm" aria-label="Delete">⌫</button>
          <button type="button" onClick={() => press("0")} className="h-16 w-16 rounded-full bg-white/10 text-2xl font-semibold">0</button>
          <button type="submit" disabled={pin.length < 4 || pending} className="h-16 w-16 rounded-full bg-gold text-sm font-bold text-navy disabled:opacity-40">OK</button>
        </div>
      </form>
    </div>
  );
}
