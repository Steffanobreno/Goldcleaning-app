import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { audience, cleanFilters, clientCities } from "@/lib/data/marketing";
import { dayLabel, isUuid, phoneLabel, timeLabel, todayYmd } from "@/lib/format";
import { marketingEmailHtml } from "@/lib/marketing-email";
import { MARKETING_TEMPLATES } from "@/lib/marketing-templates";
import { Button, Card, Notice, Page, PageHeader } from "@/components/ui";
import {
  countAudienceAction, deleteCampaignAction, duplicateCampaignAction, saveCampaignAction, saveFiltersAction,
  scheduleAction, sendNextBatchAction, sendNowAction, sendTestAction, unscheduleAction,
} from "../actions";
import { AudienceForm } from "./audience-form";
import { CampaignEditor } from "./campaign-editor";
import { SendingProgress, SendStep } from "./send-step";

export const metadata: Metadata = { title: "Email campaign" };

const STEPS = [
  { key: "edit", label: "1 Write" },
  { key: "recipients", label: "2 Who" },
  { key: "send", label: "3 Send" },
] as const;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function CampaignPage({ params, searchParams }: PageProps<"/marketing/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const tz = staff.timezone;
  const [[c], [b]] = await Promise.all([
    sql`select * from campaigns where id = ${id} and business_id = ${staff.businessId}`,
    sql`select name, phone, email, mailing_address, website_url from businesses where id = ${staff.businessId}`,
  ]);
  if (!c) notFound();
  const sample = { first_name: "Alex", pet_name: "Luna", business: b.name, booking_link: `${appUrl()}/book` };
  const editable = c.status === "draft" || c.status === "scheduled";
  const step = STEPS.find((s) => s.key === sp.step)?.key ?? "edit";

  if (!editable) {
    const [[stats], recipients] = await Promise.all([
      sql<{ total: number; sent: number; failed: number; queued: number; booked: number }[]>`
        select count(*)::int as total,
          count(*) filter (where status = 'sent')::int as sent,
          count(*) filter (where status = 'failed')::int as failed,
          count(*) filter (where status in ('queued', 'skipped'))::int as queued,
          (select count(distinct a.client_id) from campaign_recipients r join appointments a on a.client_id = r.client_id
            where r.campaign_id = ${id} and r.status = 'sent' and a.created_at > ${c.started_at})::int as booked
        from campaign_recipients where campaign_id = ${id}`,
      sql<{ client_id: string; name: string; email: string; status: string; error: string | null; booked: boolean }[]>`
        select r.client_id, trim(cl.first_name || ' ' || cl.last_name) as name, r.email, r.status, r.error,
          exists (select 1 from appointments a where a.client_id = r.client_id and a.created_at > ${c.started_at}) as booked
        from campaign_recipients r join clients cl on cl.id = r.client_id
        where r.campaign_id = ${id} order by booked desc, r.status, cl.first_name limit 500`,
    ]);
    const html = marketingEmailHtml({
      appUrl: appUrl(),
      content: { preheader: c.preheader, banner: c.banner, headline: c.headline, body: c.body, buttonLabel: c.button_label, buttonUrl: c.button_url },
      vars: sample, phone: phoneLabel(b.phone) || null, mailingAddress: b.mailing_address, unsubscribeUrl: "#",
    });
    return (
      <>
        <PageHeader title={c.name} back="/marketing" />
        <Page>
          {c.status === "sending" ? (
            <SendingProgress sent={stats.sent} total={stats.total} next={sendNextBatchAction.bind(null, id)} />
          ) : (
            <Notice kind="success">Sent {c.started_at ? `on ${dayLabel(c.started_at, tz)} at ${timeLabel(c.started_at, tz)}` : ""}.</Notice>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Sent" value={`${stats.sent}`} />
            <Stat label="Booked since" value={`${stats.booked}`} />
            <Stat label="Failed" value={`${stats.failed}`} />
          </div>
          <p className="px-1 text-xs text-muted">&quot;Booked since&quot; = clients who got the email and have a visit booked after it went out.</p>
          <details className="card px-4 py-3">
            <summary className="cursor-pointer font-semibold">Who got it ({stats.total})</summary>
            <ul className="mt-2 divide-y divide-line text-sm">
              {recipients.map((r) => (
                <li key={r.client_id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/clients/${r.client_id}`} className="min-w-0 truncate">
                    <span className="font-semibold">{r.name}</span> <span className="text-muted">{r.email}</span>
                  </Link>
                  <span className={`shrink-0 text-xs font-semibold ${r.booked ? "text-success" : r.status === "failed" ? "text-danger" : "text-muted"}`}
                    title={r.error ?? undefined}>
                    {r.booked ? "Booked ✓" : r.status === "failed" ? "Failed" : r.status === "sent" ? "Sent" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <section className="space-y-2">
            <h2 className="section-label">The email</h2>
            <iframe title="Email" srcDoc={html} className="h-[640px] w-full rounded-[var(--radius-card)] border border-line bg-white" />
          </section>
          <form action={duplicateCampaignAction.bind(null, id)}>
            <Button type="submit" kind="secondary" className="w-full">Use it again (copy)</Button>
          </form>
        </Page>
      </>
    );
  }

  const filters = cleanFilters(c.filters);
  const [cities, people] = await Promise.all([
    step === "recipients" ? clientCities(staff.businessId) : [],
    step === "send" ? audience(staff.businessId, filters) : [],
  ]);
  const count = new Set(people.map((p) => p.email)).size;

  return (
    <>
      <PageHeader title={c.name} back="/marketing" />
      <Page>
        <nav aria-label="Steps" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 shadow-[var(--shadow-card)]">
          {STEPS.map((s) => (
            <Link key={s.key} href={`/marketing/${id}?step=${s.key}`} aria-current={s.key === step ? "step" : undefined}
              className={`rounded-xl py-2 text-center text-sm font-semibold ${s.key === step ? "bg-navy text-white" : "text-muted"}`}>
              {s.label}
            </Link>
          ))}
        </nav>

        {c.status === "scheduled" && c.scheduled_at && (
          <Card className="flex items-center justify-between gap-3 border-brand bg-brand-soft">
            <span className="text-sm font-semibold text-brand-strong">
              Scheduled for {dayLabel(c.scheduled_at, tz)} at {timeLabel(c.scheduled_at, tz)}
            </span>
            <form action={unscheduleAction.bind(null, id)}>
              <button type="submit" className="text-sm font-semibold text-brand underline">Unschedule</button>
            </form>
          </Card>
        )}

        {step === "edit" && (
          <CampaignEditor
            campaign={{ name: c.name, subject: c.subject, preheader: c.preheader, banner: c.banner, headline: c.headline, body: c.body, button_label: c.button_label, button_url: c.button_url }}
            banners={MARKETING_TEMPLATES.filter((t) => t.banner).map((t) => ({ src: t.banner!, name: t.name }))}
            appUrl={appUrl()}
            sample={sample}
            phone={phoneLabel(b.phone) || null}
            mailingAddress={b.mailing_address}
            save={saveCampaignAction.bind(null, id)}
          />
        )}
        {step === "recipients" && (
          <AudienceForm initial={filters} cities={cities} count={countAudienceAction} save={saveFiltersAction.bind(null, id)} />
        )}
        {step === "send" && (
          <>
            <Card className="space-y-1 text-sm">
              <p><span className="text-muted">Subject:</span> <span className="font-semibold">{c.subject || "—"}</span></p>
              <p><span className="text-muted">To:</span> <span className="font-semibold">{count} clients</span>{" "}
                <Link href={`/marketing/${id}?step=recipients`} className="text-brand underline">change</Link></p>
            </Card>
            {!b.mailing_address && (
              <Notice kind="warn">Add your mailing address on the <Link href="/marketing" className="underline">Marketing page</Link> before sending.</Notice>
            )}
            {count > 400 && <Notice kind="info">Gmail sends about 450 emails a day, so this list finishes over {Math.ceil(count / 400)} days.</Notice>}
            <SendStep
              count={count}
              ownerEmail={b.email ?? ""}
              today={todayYmd(tz)}
              sendTest={sendTestAction.bind(null, id)}
              sendNow={sendNowAction.bind(null, id)}
              schedule={scheduleAction.bind(null, id)}
            />
          </>
        )}

        <form action={deleteCampaignAction.bind(null, id)} className="pt-4 text-center">
          <button type="submit" className="text-sm font-semibold text-danger">Delete this draft</button>
        </form>
      </Page>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
