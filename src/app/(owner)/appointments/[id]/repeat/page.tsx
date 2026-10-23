import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { timeLabel, ymd } from "@/lib/format";
import type { RepeatRule } from "@/lib/repeat";
import { Page, PageHeader } from "@/components/ui";
import { saveRepeatAction, stopRepeatAction } from "../../repeat-actions";
import { RepeatForm } from "./repeat-form";

export const metadata: Metadata = { title: "Repeat" };

export default async function RepeatPage({ params }: PageProps<"/appointments/[id]/repeat">) {
  const staff = await requireStaff();
  const { id } = await params;
  const [a] = await sql<{ client_id: string; start_at: Date; series_id: string | null; freq: RepeatRule["freq"] | null; interval_n: number | null;
                         occurrences: number | null; ends_on: string | null; pet_days: number | null }[]>`
    select a.client_id, a.start_at, a.series_id, s.freq, s.interval_n, s.occurrences, to_char(s.ends_on, 'YYYY-MM-DD') as ends_on,
      (select min(p.rebook_every_days) from appointment_pets ap join pets p on p.id = ap.pet_id where ap.appointment_id = a.id) as pet_days
    from appointments a left join appointment_series s on s.id = a.series_id
    where a.id = ${id} and a.business_id = ${staff.businessId}`;
  if (!a) notFound();
  // A new repeat starts from the pet's usual frequency (in weeks) when we know it.
  const weeks = a.pet_days ? Math.min(Math.max(Math.round(a.pet_days / 7), 1), 12) : 4;
  const initial: RepeatRule = a.freq
    ? { freq: a.freq, every: a.interval_n ?? 1, count: a.occurrences, until: a.ends_on }
    : { freq: "week", every: weeks, count: 10, until: null };
  return (
    <>
      <PageHeader title="Repeat" back={`/appointments/${id}`} />
      <Page>
        <RepeatForm
          appointmentId={id}
          clientId={a.client_id}
          first={ymd(a.start_at, staff.timezone)}
          time={timeLabel(a.start_at, staff.timezone)}
          initial={initial}
          repeating={!!a.series_id}
          save={saveRepeatAction.bind(null, id)}
          stop={stopRepeatAction.bind(null, id)}
        />
      </Page>
    </>
  );
}
