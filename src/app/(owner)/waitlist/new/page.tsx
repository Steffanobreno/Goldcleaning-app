import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fullName, getClient } from "@/lib/data/clients";
import { todayYmd } from "@/lib/format";
import { Card, Field, Input, Page, PageHeader } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { SimpleForm } from "../../settings/forms";
import { addToWaitlistAction } from "../actions";

export const metadata: Metadata = { title: "Add to waitlist" };

export default async function NewWaitlistPage({ searchParams }: PageProps<"/waitlist/new">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const client = typeof sp.client === "string" ? await getClient(staff, sp.client) : null;
  if (!client) notFound();
  const today = todayYmd(staff.timezone);
  return (
    <>
      <PageHeader title="Add to waitlist" back={`/clients/${client.id}`} />
      <Page>
        <p className="px-1 text-sm text-muted">
          <strong className="text-ink">{fullName(client)}</strong> wants a day that&apos;s full. If a visit on one of these days is
          cancelled, Today and the Waitlist tell you, with buttons to text or book them.
        </p>
        <Card>
          <SimpleForm action={addToWaitlistAction.bind(null, client.id)} submitLabel="Add to waitlist">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First day"><DateField name="from_date" min={today} required /></Field>
              <Field label="Last day (optional)"><DateField name="to_date" min={today} /></Field>
            </div>
            <Field label="Note (optional)" hint="Mornings only, any day that week…">
              <Input name="note" maxLength={300} placeholder="Mornings only" />
            </Field>
          </SimpleForm>
        </Card>
      </Page>
    </>
  );
}
