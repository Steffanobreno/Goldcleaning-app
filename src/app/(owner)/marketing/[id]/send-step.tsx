"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import type { CampaignState } from "../actions";

// Step 3: a test to yourself, then send now or pick a day and time.

export function SendStep({ count, ownerEmail, today, sendTest, sendNow, schedule }: {
  count: number;
  ownerEmail: string;
  today: string;
  sendTest: (s: CampaignState, f: FormData) => Promise<CampaignState>;
  sendNow: (s: CampaignState) => Promise<CampaignState>;
  schedule: (s: CampaignState, f: FormData) => Promise<CampaignState>;
}) {
  const [test, testAction, testing] = useActionState(sendTest, undefined);
  const [now, nowAction, sending] = useActionState(sendNow, undefined);
  const [later, laterAction, scheduling] = useActionState(schedule, undefined);
  const [sure, setSure] = useState(false);
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold">1. Send yourself a test</h2>
        <ActionForm action={testAction} className="flex gap-2">
          <Input name="to" type="email" defaultValue={ownerEmail} placeholder="you@gmail.com" aria-label="Test email" className="flex-1" />
          <Button type="submit" kind="secondary" disabled={testing}>{testing ? "Sending…" : "Send test"}</Button>
        </ActionForm>
        {test?.error && <Notice kind="error">{test.error}</Notice>}
        {test?.sent && <Notice kind="success">Sent to {test.sent}. Check how it looks on your phone.</Notice>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">2. Send it to {count} client{count === 1 ? "" : "s"}</h2>
        {now?.error && <Notice kind="error">{now.error}</Notice>}
        {!sure ? (
          <Button type="button" className="w-full py-3.5 text-base" onClick={() => setSure(true)}>Send now</Button>
        ) : (
          <ActionForm action={() => nowAction()} className="space-y-2">
            <Notice kind="warn">Emails can&apos;t be taken back once they go out. Send to {count} clients now?</Notice>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" kind="secondary" onClick={() => setSure(false)}>Not yet</Button>
              <Button type="submit" disabled={sending}>{sending ? "Starting…" : "Yes, send"}</Button>
            </div>
          </ActionForm>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Or schedule it</h2>
        {later?.error && <Notice kind="error">{later.error}</Notice>}
        <ActionForm action={laterAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day"><Input type="date" name="date" min={today} defaultValue={today} required /></Field>
            <Field label="Time"><Input type="time" name="time" step={900} defaultValue="09:00" required /></Field>
          </div>
          <Button type="submit" kind="secondary" className="w-full" disabled={scheduling}>{scheduling ? "Saving…" : "Schedule"}</Button>
          <p className="text-xs text-muted">Scheduled emails start when the app next checks in (every hour, or when your iPhone collects the texts).</p>
        </ActionForm>
      </Card>
    </div>
  );
}

/** While a campaign is sending and this page is open, keeps sending the next batch. */
export function SendingProgress({ sent, total, next }: { sent: number; total: number; next: () => Promise<number> }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let stop = false;
    let before = -1;
    (async () => {
      while (!stop) {
        let left: number;
        try {
          left = await next();
        } catch {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        router.refresh();
        if (left === 0 || stop) break;
        // Nothing went out (the daily Gmail limit): stop here, the jobs finish it tomorrow.
        if (left === before) {
          setPaused(true);
          break;
        }
        before = left;
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pct = total ? Math.round((sent / total) * 100) : 0;
  return (
    <Card className="space-y-2">
      <div className="flex justify-between text-sm font-semibold"><span>Sending…</span><span>{sent} of {total}</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-bg"><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
      <p className="text-xs text-muted">
        {paused ? "Today's Gmail limit was reached; the rest goes out tomorrow on its own."
          : "Keep this page open to send faster. If you close it, the rest goes out on its own over the next hours."}
      </p>
    </Card>
  );
}
