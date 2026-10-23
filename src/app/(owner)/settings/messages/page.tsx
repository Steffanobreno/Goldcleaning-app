import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { TestEmailButton } from "./test-email";
import { Button, Card, Field, Input, Notice, Page, PageHeader, Textarea } from "@/components/ui";
import { saveMessagingSettingsAction, saveTemplateAction, setAutoMessagesAction } from "../actions";
import { SimpleForm } from "../forms";

export const metadata: Metadata = { title: "Email messages" };

const TEMPLATE_INFO: Record<string, { title: string; when: string }> = {
  booked: { title: "Booking confirmation", when: "When you book a cleaning in the app" },
  request_received: { title: "Request received", when: "When a client sends a request online" },
  request_accepted: { title: "Request accepted", when: "When you accept an online request" },
  request_declined: { title: "Request declined", when: "When you decline an online request" },
  reminder: { title: "Appointment reminder", when: "Days before the visit, at a set time" },
  confirmed: { title: "Confirmed", when: "When the client taps Confirm on their link" },
  cancelled: { title: "Cancelled", when: "When the visit is cancelled" },
  rebook: { title: "Time to rebook", when: "When the booked frequency has passed (4 weeks after a one-time cleaning), at a set time" },
  review_request: { title: "Review request", when: "Minutes after checkout (needs the review link)" },
  abandoned_booking: { title: "Didn't finish booking", when: "A while after someone stops halfway on the booking page (8am–8pm)" },
  quote_received: { title: "Quote request received", when: "When someone asks for an Airbnb or office quote" },
};
const ORDER = Object.keys(TEMPLATE_INFO);

export default async function MessagesSettingsPage() {
  const staff = await requireStaff();
  const [b] = await sql`select email, phone, review_url, website_url, auto_messages_enabled from businesses where id = ${staff.businessId}`;
  const templates = await sql<
    { id: string; trigger: string; body: string; email_subject: string | null; enabled: boolean;
      offset_days: number | null; offset_minutes: number | null; send_at_time: string | null }[]
  >`
    select id, trigger, body, email_subject, enabled, offset_days, offset_minutes, to_char(send_at_time, 'HH24:MI') as send_at_time
    from message_templates where business_id = ${staff.businessId}`;
  templates.sort((x, y) => ORDER.indexOf(x.trigger) - ORDER.indexOf(y.trigger));

  return (
    <>
      <PageHeader title="Email messages" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Automatic messages</h2>
          {b.auto_messages_enabled ? (
            <Notice kind="success">On. Confirmations, reminders and rebook emails go out by themselves.</Notice>
          ) : (
            <Notice kind="warn">
              Off for cleanings you book in the app: turn it on when you&apos;re ready for clients to get confirmations and
              reminders by email. Requests from your online booking page always get their emails.
            </Notice>
          )}
          <form action={setAutoMessagesAction.bind(null, !b.auto_messages_enabled)}>
            <Button type="submit" kind={b.auto_messages_enabled ? "secondary" : "primary"} className="w-full">
              {b.auto_messages_enabled ? "Turn automatic messages off" : "Turn automatic messages on"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-bold">Email</h2>
          {emailConfigured() ? (
            <>
              <Notice kind="success">Email is on. Messages go out from {process.env.GMAIL_USER}.</Notice>
              <TestEmailButton />
            </>
          ) : (
            <Notice kind="warn">Email is off. Add the Gmail address and app password to the server settings.</Notice>
          )}
          <SimpleForm action={saveMessagingSettingsAction}>
            <Field label="Your email for new requests and cancellations">
              <Input name="email" type="email" defaultValue={b.email ?? ""} />
            </Field>
            <Field label="Google review link">
              <Input name="review_url" defaultValue={b.review_url ?? ""} placeholder="https://g.page/r/…/review" />
            </Field>
            <Field label="Website (where your Book Now button is)">
              <Input name="website_url" defaultValue={b.website_url ?? ""} placeholder="https://peninsulagoldcleaning.com" />
            </Field>
          </SimpleForm>
        </Card>

        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold">Message texts</h2>
            <Link href="/settings/messages/preview" className="text-sm font-semibold text-brand">Preview emails</Link>
          </div>
          <p className="px-1 text-xs text-muted">
            You can use {"{client}"}, {"{service}"}, {"{home}"} (like 3 bd / 2 ba), {"{total}"}, {"{date}"}, {"{time}"},{" "}
            {"{appointment_url}"} (their page to see, confirm or cancel), {"{booking_url}"}, {"{business}"}, {"{business_phone}"},{" "}
            {"{review_url}"}.
          </p>
          {templates.map((t) => {
            const info = TEMPLATE_INFO[t.trigger] ?? { title: t.trigger, when: "" };
            return (
              <details key={t.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <summary className="cursor-pointer">
                  <span className="font-semibold">{info.title}</span>
                  {!t.enabled && <span className="ml-2 text-xs text-muted">(off)</span>}
                  <span className="block text-xs text-muted">{info.when}</span>
                </summary>
                <div className="mt-3">
                  <SimpleForm action={saveTemplateAction.bind(null, t.id)}>
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" name="enabled" defaultChecked={t.enabled} className="h-4 w-4" />
                      Send this message
                    </label>
                    {t.trigger === "reminder" && (
                      <Field label="Days before the visit">
                        <Input name="offset_days" type="number" min={0} max={14} defaultValue={t.offset_days ?? 2} />
                      </Field>
                    )}
                    {(t.trigger === "reminder" || t.trigger === "rebook") && (
                      <Field label="Send at">
                        <Input name="send_at_time" type="time" defaultValue={t.send_at_time ?? "10:00"} />
                      </Field>
                    )}
                    {t.trigger === "abandoned_booking" && (
                      <Field label="Minutes after they stop">
                        <Input name="offset_minutes" type="number" min={30} max={1440} defaultValue={t.offset_minutes ?? 120} />
                      </Field>
                    )}
                    {t.trigger === "review_request" && (
                      <Field label="Minutes after checkout">
                        <Input name="offset_minutes" type="number" min={0} max={1440} defaultValue={t.offset_minutes ?? 30} />
                      </Field>
                    )}
                    <Field label="Text">
                      <Textarea name="body" rows={4} defaultValue={t.body} />
                    </Field>
                    {t.trigger !== "on_my_way" && (
                      <Field label="Email subject">
                        <Input name="email_subject" defaultValue={t.email_subject ?? ""} />
                      </Field>
                    )}
                  </SimpleForm>
                </div>
              </details>
            );
          })}
        </section>
      </Page>
    </>
  );
}
