"use client";
import { useEffect, useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { removePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from "./actions";

// Turns notifications on for this device. On the iPhone this works only from the app on the
// Home Screen (Safari → Share → Add to Home Screen), iOS 16.4 or newer.

const toKey = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type State = "loading" | "unsupported" | "needs-home-screen" | "denied" | "off" | "on";

export function PushSetup({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(ios && !standalone ? "needs-home-screen" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = () =>
    start(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState("denied");
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const device = /iPhone/.test(navigator.userAgent) ? "iPhone" : /iPad/.test(navigator.userAgent) ? "iPad" : /Android/.test(navigator.userAgent) ? "Android" : "Computer";
        const res = await savePushSubscriptionAction(json, device);
        if (res?.error) return setMessage({ kind: "error", text: res.error });
        setEndpoint(sub.endpoint);
        setState("on");
        setMessage({ kind: "success", text: "Notifications are on for this device." });
      } catch {
        setMessage({ kind: "error", text: "Couldn't turn notifications on. Try again, or check the phone's notification settings." });
      }
    });

  const turnOff = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      if (endpoint) await removePushSubscriptionAction(endpoint);
      setEndpoint(null);
      setState("off");
      setMessage(null);
    });

  const test = () =>
    start(async () => {
      const { sent } = await testPushAction();
      setMessage(sent ? { kind: "success", text: "Sent. It should pop up in a few seconds." } : { kind: "error", text: "No device has notifications on yet." });
    });

  return (
    <div className="space-y-3">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {state === "loading" && <p className="text-sm text-muted">Checking this device…</p>}
      {state === "needs-home-screen" && (
        <Notice kind="warn">
          On the iPhone, notifications only work from the app on your Home Screen. In Safari tap Share → Add to Home Screen,
          open Woofers from the Home Screen icon, and come back here.
        </Notice>
      )}
      {state === "unsupported" && <Notice kind="warn">This browser can&apos;t show notifications. Use Safari on the iPhone (from the Home Screen) or Chrome.</Notice>}
      {state === "denied" && (
        <Notice kind="warn">
          Notifications are blocked for this app. iPhone: Settings → Notifications → Woofers → Allow Notifications. Then come back here.
        </Notice>
      )}
      {state === "off" && <Button className="w-full py-3.5 text-base" disabled={pending} onClick={turnOn}>{pending ? "…" : "Turn on notifications on this device"}</Button>}
      {state === "on" && (
        <>
          <Notice kind="success">This device gets notifications.</Notice>
          <div className="grid grid-cols-2 gap-2">
            <Button kind="secondary" disabled={pending} onClick={test}>Send a test</Button>
            <Button kind="danger" disabled={pending} onClick={turnOff}>Turn off here</Button>
          </div>
        </>
      )}
    </div>
  );
}
