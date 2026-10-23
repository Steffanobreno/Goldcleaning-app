"use client";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { marketingEmailHtml, type MarketingVars } from "@/lib/marketing-email";
import type { CampaignState } from "../actions";

// Step 1: what the email says, with the email shown live underneath as the client will see it.

export type EditorCampaign = {
  name: string; subject: string; preheader: string; banner: string | null; headline: string; body: string; button_label: string | null; button_url: string | null;
};

export function CampaignEditor({ campaign, banners, appUrl, sample, phone, mailingAddress, save }: {
  campaign: EditorCampaign;
  banners: { src: string; name: string }[];
  appUrl: string;
  sample: MarketingVars;
  phone: string | null;
  mailingAddress: string | null;
  save: (state: CampaignState, form: FormData) => Promise<CampaignState>;
}) {
  const [state, action, pending] = useActionState(save, undefined);
  const [c, setC] = useState(campaign);
  const set = (k: keyof EditorCampaign) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value });
  const html = marketingEmailHtml({
    appUrl,
    content: { preheader: c.preheader, banner: c.banner, headline: c.headline, body: c.body, buttonLabel: c.button_label, buttonUrl: c.button_url },
    vars: sample, phone, mailingAddress, unsubscribeUrl: "#",
  });
  return (
    <ActionForm action={action} className="space-y-4">
      {state?.error && <Notice kind="error">{state.error}</Notice>}
      {state?.saved && <Notice kind="success">Saved.</Notice>}
      <Card className="space-y-3">
        <Field label="Campaign name" hint="Only you see this.">
          <Input name="name" value={c.name} onChange={set("name")} />
        </Field>
        <Field label="Subject" hint="The first thing clients read in their inbox. {pet_name} and {first_name} work here too.">
          <Input name="subject" value={c.subject} onChange={set("subject")} placeholder="We miss {pet_name}! 🐾" />
        </Field>
        <Field label="Preview text" hint="The grey line after the subject in the inbox. A short teaser gets more opens.">
          <Input name="preheader" value={c.preheader} onChange={set("preheader")} placeholder="Your spa day is just a few taps away." />
        </Field>
      </Card>

      <Card className="space-y-2">
        <span className="text-sm font-medium">Picture</span>
        <input type="hidden" name="banner" value={c.banner ?? ""} />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => setC({ ...c, banner: null })} aria-pressed={!c.banner}
            className={`flex h-16 w-28 shrink-0 items-center justify-center rounded-lg border-2 bg-bg text-xs text-muted ${!c.banner ? "border-brand" : "border-transparent"}`}>
            No picture
          </button>
          {banners.map((b) => (
            <button key={b.src} type="button" onClick={() => setC({ ...c, banner: b.src })} aria-pressed={c.banner === b.src} title={b.name}
              className={`h-16 w-28 shrink-0 overflow-hidden rounded-lg border-2 ${c.banner === b.src ? "border-brand" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- small static picture */}
              <img src={b.src} alt={b.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <Field label="Headline">
          <Input name="headline" value={c.headline} onChange={set("headline")} placeholder="Happy Halloween!" />
        </Field>
        <Field label="Message" hint="{first_name} = client's first name · {pet_name} = their pets · {business} = Woofers Dog Spa">
          <Textarea name="body" rows={9} value={c.body} onChange={set("body")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Button text" hint="Empty = no button">
            <Input name="button_label" value={c.button_label ?? ""} onChange={set("button_label")} placeholder="Book now" />
          </Field>
          <Field label="Button link" hint="Empty = your booking page">
            <Input name="button_url" value={c.button_url ?? ""} onChange={set("button_url")} placeholder={sample.booking_link} inputMode="url" />
          </Field>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="section-label">Preview (sample client: {sample.first_name}, pet {sample.pet_name})</h2>
        <iframe title="Email preview" srcDoc={html} className="h-[720px] w-full rounded-[var(--radius-card)] border border-line bg-white" />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" kind="secondary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="submit" name="next" value="1" disabled={pending}>Next: who gets it →</Button>
      </div>
    </ActionForm>
  );
}
