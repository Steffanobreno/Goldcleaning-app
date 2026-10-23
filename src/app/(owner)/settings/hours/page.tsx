import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveHoursAction } from "../actions";
import { HoursForm } from "../forms";

export const metadata: Metadata = { title: "Working hours" };

export default async function HoursPage() {
  const staff = await requireStaff();
  const rows = await sql<{ weekday: number; start: string; end: string }[]>`
    select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
    from working_hours where staff_id = ${staff.staffId} order by weekday`;
  return (
    <>
      <PageHeader title="Working hours" back="/settings" />
      <Page>
        <Card>
          <HoursForm action={saveHoursAction} hours={rows} />
        </Card>
      </Page>
    </>
  );
}
