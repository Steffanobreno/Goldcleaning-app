import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { isYmd, todayYmd } from "@/lib/format";
import { Page, PageHeader } from "@/components/ui";
import { createBlockAction } from "../actions";
import { BlockForm } from "./block-form";
import { listGroomers } from "@/lib/data/staff";

export const metadata: Metadata = { title: "Block time" };

const plusHour = (t: string) => `${String(Math.min(Number(t.slice(0, 2)) + 1, 23)).padStart(2, "0")}:${t.slice(3, 5)}`;

export default async function NewBlockPage({ searchParams }: PageProps<"/calendar/block">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const date = isYmd(sp.date) ? sp.date : todayYmd(staff.timezone);
  const groomers = await listGroomers(staff, { activeOnly: true });
  const start = typeof sp.start === "string" && /^\d{2}:\d{2}$/.test(sp.start) ? sp.start : "12:00";
  return (
    <>
      <PageHeader title="Block time" back={`/calendar?date=${date}`} />
      <Page>
        <BlockForm action={createBlockAction} isNew initial={{ date, start, end: plusHour(start), allDay: false, reason: "" }}
          groomers={groomers} defaultGroomer={typeof sp.groomer === "string" ? sp.groomer : staff.staffId} />
      </Page>
    </>
  );
}
