import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hm, ymd, longDayLabel, timeLabel } from "@/lib/format";
import { Empty, Page, PageHeader } from "@/components/ui";
import { UpcomingRow } from "./upcoming-row";

export const metadata: Metadata = { title: "Upcoming visits" };

/** All of a client's coming visits in one list, each with a quick Move: for the week a visit has to change day. */
export default async function UpcomingPage({ params }: PageProps<"/clients/[id]/upcoming">) {
  const staff = await requireStaff();
  const { id } = await params;
  const [client] = await sql<{ name: string }[]>`select first_name || ' ' || last_name as name from clients where id = ${id} and business_id = ${staff.businessId}`;
  if (!client) notFound();
  const rows = await sql<{ id: string; start_at: Date; end_at: Date; status: string; recurring: boolean }[]>`
    select id, start_at, end_at, status, series_id is not null as recurring from appointments
    where client_id = ${id} and business_id = ${staff.businessId} and start_at > now()
      and status in ('requested', 'unconfirmed', 'confirmed') order by start_at`;
  const tz = staff.timezone;
  return (
    <>
      <PageHeader title="Upcoming visits" back={`/clients/${id}`} />
      <Page>
        <p className="px-1 text-sm text-muted">
          {client.name}. Pick a new day and tap Move. The clients get an email about the new time if you leave it checked.
        </p>
        {rows.length === 0 ? (
          <Empty title="No upcoming visits" />
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => (
              <UpcomingRow key={a.id} id={a.id} date={ymd(a.start_at, tz)} time={hm(a.start_at, tz)}
                label={`${longDayLabel(a.start_at, tz)} · ${timeLabel(a.start_at, tz)}`} recurring={a.recurring} />
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
