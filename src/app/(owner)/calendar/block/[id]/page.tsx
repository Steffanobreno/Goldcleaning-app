import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getTimeOff, isAllDay } from "@/lib/data/time-off";
import { hm, ymd } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { deleteBlockAction, updateBlockAction } from "../../actions";
import { BlockForm } from "../block-form";

export const metadata: Metadata = { title: "Blocked time" };

export default async function EditBlockPage({ params }: PageProps<"/calendar/block/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const block = await getTimeOff(staff, id);
  if (!block) notFound();
  const tz = staff.timezone;
  const date = ymd(block.start_at, tz);
  const remove = deleteBlockAction.bind(null, id);
  return (
    <>
      <PageHeader title="Blocked time" back={`/calendar?date=${date}`} />
      <Page>
        <BlockForm
          action={updateBlockAction.bind(null, id)}
          isNew={false}
          initial={{ date, start: hm(block.start_at, tz), end: hm(block.end_at, tz), allDay: isAllDay(block, tz), reason: block.reason ?? "" }}
        />
        <Card className="space-y-2">
          <form action={remove}>
            <input type="hidden" name="date" value={date} />
            <button type="submit" className="w-full rounded-xl border border-line py-3 font-semibold text-danger hover:bg-danger-soft">
              Remove this block
            </button>
          </form>
          {block.series_id && (
            <form action={remove}>
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="scope" value="following" />
              <button type="submit" className="w-full rounded-xl border border-line py-3 font-semibold text-danger hover:bg-danger-soft">
                Remove this and the next repeats
              </button>
            </form>
          )}
        </Card>
      </Page>
    </>
  );
}
