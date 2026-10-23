import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { lastSentByTemplate } from "@/lib/data/marketing";
import { todayYmd } from "@/lib/format";
import { MARKETING_TEMPLATES, nextDate, suggestions, type MarketingTemplate } from "@/lib/marketing-templates";
import { Page, PageHeader } from "@/components/ui";
import { createCampaignAction } from "../actions";

export const metadata: Metadata = { title: "New email" };

const fmt = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

export default async function NewCampaignPage() {
  const staff = await requireStaff();
  const today = todayYmd(staff.timezone);
  const lastSent = await lastSentByTemplate(staff.businessId, staff.timezone);
  const days = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  const suggested = suggestions(today, lastSent);
  const anytime = MARKETING_TEMPLATES.filter((t) => t.kind === "anytime");
  const seasons = MARKETING_TEMPLATES.filter((t) => t.kind === "season")
    .map((t) => ({ t, next: nextDate(t, today)! }))
    .sort((a, b) => (a.next < b.next ? -1 : 1));

  const card = (t: MarketingTemplate, next: string | null, highlight = false) => (
    <li key={t.key}>
      <form action={createCampaignAction.bind(null, t.key)}>
        <button type="submit" className={`card block w-full overflow-hidden p-0 text-left hover:shadow-md ${highlight ? "ring-2 ring-brand" : ""}`}>
          {t.banner ? (
            // eslint-disable-next-line @next/next/no-img-element -- small static picture
            <img src={t.banner} alt="" className="aspect-[5/2] w-full object-cover" />
          ) : (
            <span className="flex aspect-[5/2] w-full items-center justify-center bg-bg text-muted">Blank</span>
          )}
          <span className="block px-4 py-3">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-bold">{t.name}</span>
              {next && (
                <span className={`shrink-0 text-xs font-semibold ${days(next) <= 21 ? "text-brand" : "text-muted"}`}>
                  {days(next) === 0 ? "Today" : `${fmt(next)} · in ${days(next)} days`}
                </span>
              )}
            </span>
            <span className="block truncate text-sm text-muted">{t.subject || "Write your own"}</span>
            {lastSent[t.key] && (
              <span className="mt-1 inline-block rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-muted">
                Last sent {fmt(lastSent[t.key]!, { month: "short", year: "numeric" })}
              </span>
            )}
          </span>
        </button>
      </form>
    </li>
  );

  return (
    <>
      <PageHeader title="Pick a template" back="/marketing" />
      <Page>
        {suggested.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">Suggested now</h2>
            <p className="px-1 text-sm text-muted">What fits this time of year, and what your clients haven&apos;t seen in a while.</p>
            <ul className="grid gap-3 sm:grid-cols-2">{suggested.map((t) => card(t, nextDate(t, today), true))}</ul>
          </section>
        )}
        <section className="space-y-2">
          <h2 className="section-label">Any time</h2>
          <ul className="grid gap-3 sm:grid-cols-2">{anytime.map((t) => card(t, null))}</ul>
        </section>
        <section className="space-y-2">
          <h2 className="section-label">Seasons and holidays</h2>
          <p className="px-1 text-sm text-muted">In the order they come up. Send about a week before.</p>
          <ul className="grid gap-3 sm:grid-cols-2">{seasons.map(({ t, next }) => card(t, next))}</ul>
        </section>
        <p className="px-1 text-xs text-muted">Each template starts with a sensible audience (for example, clients with nothing booked yet). You can change it in step 2.</p>
      </Page>
    </>
  );
}
