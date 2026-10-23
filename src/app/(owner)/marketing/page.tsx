import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { emailsLeftToday, lastSentByTemplate } from "@/lib/data/marketing";
import { dayLabel, timeLabel, todayYmd } from "@/lib/format";
import { suggestions } from "@/lib/marketing-templates";
import { ButtonLink, Card, Empty, Page, PageHeader } from "@/components/ui";
import { MailingAddressForm } from "./mailing-address-form";
import { createCampaignAction, setMarketingReminderAction } from "./actions";

export const metadata: Metadata = { title: "Marketing" };

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-bg text-muted" },
  scheduled: { label: "Scheduled", className: "bg-brand-soft text-brand-strong" },
  sending: { label: "Sending", className: "bg-warn-soft text-warn" },
  sent: { label: "Sent", className: "bg-success-soft text-success" },
};

export default async function MarketingPage() {
  const staff = await requireStaff();
  const tz = staff.timezone;
  const [[b], campaigns, left, lastSent] = await Promise.all([
    sql<{ mailing_address: string | null; marketing_reminder: boolean }[]>`
      select mailing_address, marketing_reminder from businesses where id = ${staff.businessId}`,
    sql<{ id: string; name: string; subject: string; banner: string | null; status: string; scheduled_at: Date | null;
          started_at: Date | null; created_at: Date; sent: number; total: number; booked: number }[]>`
      select c.id, c.name, c.subject, c.banner, c.status, c.scheduled_at, c.started_at, c.created_at,
        (select count(*) from campaign_recipients r where r.campaign_id = c.id and r.status = 'sent')::int as sent,
        (select count(*) from campaign_recipients r where r.campaign_id = c.id)::int as total,
        (select count(distinct a.client_id) from campaign_recipients r join appointments a on a.client_id = r.client_id
          where r.campaign_id = c.id and r.status = 'sent' and a.created_at > c.started_at)::int as booked
      from campaigns c where c.business_id = ${staff.businessId} order by c.created_at desc limit 100`,
    emailsLeftToday(staff.businessId),
    lastSentByTemplate(staff.businessId, tz),
  ]);
  const [pick] = suggestions(todayYmd(tz), lastSent);

  return (
    <>
      <PageHeader title="Marketing" action={<ButtonLink href="/marketing/new">New email</ButtonLink>} />
      <Page>
        {!b.mailing_address && (
          <Card className="space-y-2">
            <h2 className="font-bold">Your mailing address</h2>
            <p className="text-sm text-muted">
              US law (CAN-SPAM) asks marketing emails to show a postal address: your street address or a PO box. It goes in
              small print at the bottom.
            </p>
            <MailingAddressForm value="" />
          </Card>
        )}

        {pick && (
          <Card className="flex items-center gap-3 p-3">
            {pick.banner && (
              // eslint-disable-next-line @next/next/no-img-element -- small static picture
              <img src={pick.banner} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase text-brand">Suggested this month</span>
              <span className="block truncate font-bold">{pick.name}</span>
            </span>
            <form action={createCampaignAction.bind(null, pick.key)}>
              <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand">Start</button>
            </form>
          </Card>
        )}

        {campaigns.length === 0 ? (
          <Empty title="No email campaigns yet">
            Send a holiday hello, or a &quot;we miss you&quot; to clients who haven&apos;t booked in a while.
            <div className="mt-3"><ButtonLink href="/marketing/new">Create your first email</ButtonLink></div>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => {
              const s = STATUS[c.status];
              return (
                <li key={c.id}>
                  <Link href={`/marketing/${c.id}`} className="card flex gap-3 overflow-hidden p-3 hover:bg-bg">
                    {c.banner ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small static picture
                      <img src={c.banner} alt="" className="h-16 w-28 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-bg text-2xl">✉️</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate font-bold">{c.name}</span>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">{c.subject || "No subject yet"}</span>
                      <span className="block text-xs text-muted">
                        {c.status === "scheduled" && c.scheduled_at ? `Goes out ${dayLabel(c.scheduled_at, tz)} at ${timeLabel(c.scheduled_at, tz)}`
                          : c.status === "draft" ? `Created ${dayLabel(c.created_at, tz)}`
                            : `${c.sent}/${c.total} sent${c.started_at ? ` · ${dayLabel(c.started_at, tz)}` : ""} · ${c.booked} booked since`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-center text-xs text-muted">
          Emails go out from the Woofers Gmail. Gmail sends about 450 a day, so bigger lists finish the next day.
          {left < 450 && ` ${left} left today.`}
        </p>
        <form action={setMarketingReminderAction.bind(null, !b.marketing_reminder)} className="card flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block font-semibold">Monthly reminder</span>
            <span className="block text-sm text-muted">On the 1st, a notification with this month&apos;s suggested email</span>
          </span>
          <button type="submit" role="switch" aria-checked={b.marketing_reminder} aria-label="Monthly reminder"
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${b.marketing_reminder ? "bg-success" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${b.marketing_reminder ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </form>
        {b.mailing_address && (
          <details className="card px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">Mailing address in the emails</summary>
            <div className="mt-2"><MailingAddressForm value={b.mailing_address} /></div>
          </details>
        )}
      </Page>
    </>
  );
}
