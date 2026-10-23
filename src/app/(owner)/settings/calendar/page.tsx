import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { googleCalendarScript } from "@/lib/google-calendar-script";

export const metadata: Metadata = { title: "Google Calendar" };

export default async function CalendarSettingsPage() {
  const staff = await requireStaff();
  const [b] = await sql`select device_key, name, calendar_synced_at from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const feed = `${appUrl}/api/device/calendar?key=${b.device_key}`;
  const script = googleCalendarScript(`${feed}&format=json`, b.name, staff.timezone);
  return (
    <>
      <PageHeader title="Google Calendar" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Automatic, every 15 minutes (recommended)</h2>
          {b.calendar_synced_at ? (
            <Notice kind="success">
              Connected. Last sync:{" "}
              {b.calendar_synced_at.toLocaleString("en-US", { timeZone: staff.timezone, dateStyle: "medium", timeStyle: "short" })}.
            </Notice>
          ) : (
            <Notice kind="warn">Not connected yet. Follow the steps below once.</Notice>
          )}
          <p className="text-sm text-muted">
            A small free script in the Woofers Google account copies every visit (and every online request) into a
            &quot;{b.name}&quot; calendar: pets, services, phone and address. New, moved and cancelled visits show up within
            15 minutes, from 6am to 9pm. Set it up once, on a computer.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>Open <strong>script.google.com</strong> signed in with the Woofers Google account → <strong>New project</strong>.</li>
            <li>Delete what is in the editor and paste the script below (<strong>Copy</strong>).</li>
            <li>Press <strong>Save</strong> (disk icon). In the bar at the top choose <strong>setup</strong>, then <strong>Run</strong>.</li>
            <li>
              Google asks for permission: <strong>Review permissions</strong> → the Woofers account →
              <strong> Advanced → Go to Untitled project</strong> → <strong>Allow</strong>. It is your own script, so Google
              shows the &quot;not verified&quot; notice.
            </li>
            <li>Open Google Calendar: the &quot;{b.name}&quot; calendar is there with your visits.</li>
          </ol>
          <CopyField label="Script for script.google.com (keep it private: it has your calendar key)" value={script} multiline />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Or subscribe with a link</h2>
          <p className="text-sm text-muted">
            Simpler, but Google refreshes subscribed calendars only every few hours. On calendar.google.com →
            <strong> Other calendars</strong> → <strong>+</strong> → <strong>From URL</strong> → paste. On the iPhone:
            Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar.
          </p>
          <CopyField label="Your calendar link (keep it private)" value={feed} />
        </Card>
        <Notice kind="warn">
          Use one of the two, not both, and turn off the old app&apos;s Google Calendar sync when you stop using it, so
          visits don&apos;t show up twice.
        </Notice>
      </Page>
    </>
  );
}
