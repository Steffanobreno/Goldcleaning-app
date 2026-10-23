import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { emailHtml, type EmailDetails } from "@/lib/email";
import { emailDetails, render, type Trigger } from "@/lib/messaging";
import { phoneLabel } from "@/lib/format";
import { Notice, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Email preview" };

const TRIGGERS: { trigger: Trigger; label: string }[] = [
  { trigger: "request_received", label: "Request received" },
  { trigger: "booked", label: "Booked" },
  { trigger: "reminder", label: "Reminder" },
  { trigger: "confirmed", label: "Confirmed" },
  { trigger: "cancelled", label: "Cancelled" },
  { trigger: "rebook", label: "Rebook" },
  { trigger: "review_request", label: "Review" },
];

// Shows an email exactly as a client gets it, filled in with the latest visit
// (or a made-up one when there are no visits yet).
export default async function EmailPreviewPage({ searchParams }: PageProps<"/settings/messages/preview">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const trigger = TRIGGERS.find((t) => t.trigger === sp.trigger)?.trigger ?? "request_received";
  const [b] = await sql`select name, phone, website_url, review_url, now() + interval '3 days' as sample_at
                        from businesses where id = ${staff.businessId}`;
  const [t] = await sql`select body, email_subject from message_templates where business_id = ${staff.businessId} and trigger = ${trigger}`;
  const [latest] = await sql`
    select a.id, a.start_at, a.public_token, c.first_name,
      (select string_agg(p.name, ' & ') from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = a.id) as pets
    from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${staff.businessId}
      and exists (select 1 from appointment_pets ap join appointment_services s on s.appointment_pet_id = ap.id where ap.appointment_id = a.id)
    order by (a.source = 'online') desc, a.created_at desc limit 1`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-US", { timeZone: staff.timezone, ...o });
  const start: Date = latest?.start_at ?? b.sample_at;
  const vars = {
    business: b.name,
    business_phone: phoneLabel(b.phone),
    client: latest?.first_name ?? "Ana",
    pet: latest?.pets ?? "Luna",
    date: fmt(start, { weekday: "short", month: "short", day: "numeric" }),
    time: fmt(start, { hour: "numeric", minute: "2-digit" }),
    link: `${appUrl}/a/${latest?.public_token ?? "0".repeat(24)}`,
    booking_url: b.website_url ?? `${appUrl}/book`,
    review_url: b.review_url ?? "",
    days: 42,
  };
  const sample: EmailDetails = {
    heading: "Your request", badge: "Waiting for confirmation",
    when: `${fmt(start, { weekday: "long", month: "long", day: "numeric" })} · ${vars.time}`,
    address: "1 Main St, San Mateo, CA", pets: [{ name: "Luna", services: [{ name: "Bath - Small (12\" or less)", price: "$99" }] }],
    total: "$99", link: vars.link, businessPhone: vars.business_phone || null,
    policy: "Free cancellation up to 48 hours before the visit. After that, 50% of the service price applies.",
    calendar: ["booked", "confirmed", "reminder"].includes(trigger) ? { apple: "#", google: "#", ics: "" } : null,
  };
  const details = latest ? await emailDetails(latest.id, trigger) : ["rebook", "review_request"].includes(trigger) ? null : sample;
  // The calendar buttons only go with a booked visit; show them on the preview anyway.
  if (details && !details.calendar && sample.calendar) details.calendar = sample.calendar;
  const text = render(t?.body ?? "", vars);
  const subject = render(t?.email_subject ?? b.name, vars);

  return (
    <>
      <PageHeader title="Email preview" back="/settings/messages" />
      <Page>
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Message">
          {TRIGGERS.map((x) => (
            <Link key={x.trigger} href={`/settings/messages/preview?trigger=${x.trigger}`} aria-current={x.trigger === trigger ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${x.trigger === trigger ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
              {x.label}
            </Link>
          ))}
        </nav>
        <div className="card px-4 py-3 text-sm">
          <p><span className="text-muted">From </span>{b.name}</p>
          <p><span className="text-muted">Subject </span><strong>{subject}</strong></p>
        </div>
        <iframe title="Email preview" srcDoc={emailHtml(text, b.name, details)} className="h-[760px] w-full rounded-[var(--radius-card)] border border-line bg-white" />
        <Notice kind="info">
          {latest ? "Filled in with your latest visit. " : "Filled in with a made-up visit. "}
          To change the words, edit the message in Texts and email; the card with the date, pets and price is added by the app.
        </Notice>
      </Page>
    </>
  );
}
