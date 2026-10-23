import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Field, Input, Page, PageHeader, Textarea } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";
import { CopyField } from "@/components/copy-field";
import { saveBookingSettingsAction } from "../actions";
import { SimpleForm } from "../forms";

export const metadata: Metadata = { title: "Online booking" };

export default async function BookingSettingsPage() {
  const staff = await requireStaff();
  const [b] = await sql`
    select online_booking_enabled, base_duration_min, large_home_bedrooms, large_home_extra_min, service_cities,
           min_notice_hours, booking_days_ahead, cancellation_hours
    from businesses where id = ${staff.businessId}`;
  const slots = await sql<{ weekday: number; time: string; label: string }[]>`
    select weekday, to_char(start_time, 'HH24:MI') as time, label from booking_slots
    where business_id = ${staff.businessId} order by weekday, start_time`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const bookUrl = `${appUrl}/book`;
  const embed = `<iframe src="${bookUrl}" title="Book a cleaning" style="width:100%;min-height:1400px;border:0"></iframe>`;
  return (
    <>
      <PageHeader title="Online booking" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Your booking page</h2>
          <CopyField label="Link for the Book Now button" value={bookUrl} />
          <CopyField label="Or embed it inside a page of your site" value={embed} />
        </Card>
        <Card>
          <SimpleForm action={saveBookingSettingsAction}>
            <label className="flex items-center gap-3 font-medium">
              <input type="checkbox" name="online_booking_enabled" defaultChecked={b.online_booking_enabled} className="h-5 w-5" />
              Clients can request appointments online
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cleaning length (min)" hint="For most homes.">
                <Input name="base_duration_min" inputMode="numeric" defaultValue={b.base_duration_min} />
              </Field>
              <Field label="Homes with more than (bedrooms)">
                <Input name="large_home_bedrooms" inputMode="numeric" defaultValue={b.large_home_bedrooms} />
              </Field>
              <Field label="…take extra (min)">
                <Input name="large_home_extra_min" inputMode="numeric" defaultValue={b.large_home_extra_min} />
              </Field>
              <Field label="Minimum notice (hours)">
                <Input name="min_notice_hours" inputMode="numeric" defaultValue={b.min_notice_hours} />
              </Field>
              <Field label="Book up to (days ahead)">
                <Input name="booking_days_ahead" inputMode="numeric" defaultValue={b.booking_days_ahead} />
              </Field>
              <Field label="Clients can cancel up to (hours before)">
                <Input name="cancellation_hours" inputMode="numeric" defaultValue={b.cancellation_hours} />
              </Field>
            </div>
            <Field label="Cities we serve" hint="One per line. A ZIP is accepted when its city is on this list.">
              <Textarea name="service_cities" rows={8} defaultValue={(b.service_cities as string[]).join("\n")} />
            </Field>
          </SimpleForm>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">Start times clients can pick</h2>
          <ul className="text-sm">
            {slots.map((x) => (
              <li key={`${x.weekday}-${x.time}`}>{WEEKDAYS[x.weekday]} · {x.time} ({x.label})</li>
            ))}
          </ul>
        </Card>
        <p className="text-center text-xs text-muted">
          Requests show up in Today and in Requests. They hold the time until you accept or decline.
        </p>
      </Page>
    </>
  );
}
