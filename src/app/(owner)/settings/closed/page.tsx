import { DateField } from "@/components/date-field";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listClosedDates } from "@/lib/data/closed";
import { todayYmd } from "@/lib/format";
import { HOLIDAYS } from "@/lib/holidays";
import { Card, Empty, Field, Input, Page, PageHeader } from "@/components/ui";
import { SimpleForm } from "../forms";
import { addClosedDatesAction, deleteClosedDatesAction, saveHolidaysAction } from "./actions";

export const metadata: Metadata = { title: "Closed dates and holidays" };

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function ClosedPage() {
  const staff = await requireStaff();
  const today = todayYmd(staff.timezone);
  const year = Number(today.slice(0, 4));
  const [dates, [b]] = await Promise.all([
    listClosedDates(staff.businessId),
    sql<{ closed_holidays: string[] }[]>`select closed_holidays from businesses where id = ${staff.businessId}`,
  ]);
  // The next time each holiday comes around: this year's, or next year's when it has passed.
  const next = HOLIDAYS.map((h) => ({ ...h, on: h.date(year) >= today ? h.date(year) : h.date(year + 1) }))
    .sort((x, y) => x.on.localeCompare(y.on));
  return (
    <>
      <PageHeader title="Closed dates and holidays" back="/settings" />
      <Page>
        <p className="text-sm text-muted">
          On these days clients can&apos;t book online, and the calendar shows the day as closed.
        </p>
        <section className="space-y-2">
          <h2 className="section-label">Closed dates</h2>
          {dates.length ? (
            <ul className="card divide-y divide-line overflow-hidden">
              {dates.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {dateLabel(d.start_date)}
                      {d.end_date !== d.start_date && ` – ${dateLabel(d.end_date)}`}
                    </div>
                    <div className="text-sm text-muted">{d.reason || "Closed"}{d.end_date < today && " · past"}</div>
                  </div>
                  <form action={deleteClosedDatesAction.bind(null, d.id)}>
                    <button type="submit" className="rounded-lg px-2 py-1 text-sm font-semibold text-danger hover:bg-danger-soft"
                      aria-label={`Remove closed dates from ${d.start_date}`}>
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No closed dates">Add your next vacation below.</Empty>
          )}
          <Card>
            <SimpleForm action={addClosedDatesAction} submitLabel="Add closed dates" savedLabel="Added.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First day">
                  <DateField name="start_date" min={today} required />
                </Field>
                <Field label="Last day">
                  <DateField name="end_date" min={today} />
                </Field>
              </div>
              <Field label="Reason (optional)" hint="Only you see it.">
                <Input name="reason" placeholder="Vacation" maxLength={80} />
              </Field>
            </SimpleForm>
          </Card>
        </section>
        <section className="space-y-2">
          <h2 className="section-label">Holidays {year}–{year + 1}</h2>
          <Card>
            <SimpleForm action={saveHolidaysAction} submitLabel="Save holidays" savedLabel="Holidays saved.">
              <p className="text-sm text-muted">Turn off the holidays you don&apos;t work. They repeat every year.</p>
              <ul className="divide-y divide-line">
                {next.map((h) => (
                  <li key={h.key}>
                    <label className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{h.name}</span>
                        <span className="block text-xs text-muted">{dateLabel(h.on)}</span>
                      </span>
                      <span className="text-sm text-muted">Closed</span>
                      <input type="checkbox" name={`closed:${h.key}`} defaultChecked={b.closed_holidays.includes(h.key)}
                        className="h-5 w-5" aria-label={`Closed on ${h.name}`} />
                    </label>
                  </li>
                ))}
              </ul>
            </SimpleForm>
          </Card>
        </section>
      </Page>
    </>
  );
}
