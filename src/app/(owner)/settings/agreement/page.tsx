import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { activeAgreement } from "@/lib/agreement";
import { sql } from "@/lib/db";
import { Card, Field, Input, Page, PageHeader, Textarea } from "@/components/ui";
import { AgreementText } from "@/components/agreement-text";
import { saveAgreementAction } from "../actions";
import { SimpleForm } from "../forms";

export const metadata: Metadata = { title: "Service agreement" };

export default async function AgreementPage() {
  const staff = await requireStaff();
  const agreement = await activeAgreement(staff.businessId);
  const [{ signed }] = agreement
    ? await sql`select count(distinct client_id)::int as signed from agreement_signatures
                where agreement_id = ${agreement.id} and agreement_version = ${agreement.version}`
    : [{ signed: 0 }];
  return (
    <>
      <PageHeader title="Service agreement" back="/settings" />
      <Page>
        <p className="text-sm text-muted">
          Clients sign by typing their name: when they book online, and on their confirm link if they haven&apos;t signed in
          the last 12 months. {agreement && `Version ${agreement.version}: signed by ${signed} client${signed === 1 ? "" : "s"}.`}
        </p>
        <Card>
          <SimpleForm action={saveAgreementAction}>
            <Field label="Title">
              <Input name="title" defaultValue={agreement?.title ?? ""} required />
            </Field>
            <Field label="Text" hint='Start a line with "## " for a heading and "- " for a bullet. Wrap words in ** for bold.'>
              <Textarea name="body" rows={18} defaultValue={agreement?.body ?? ""} required />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="required_online" defaultChecked={agreement?.required_online ?? true} className="h-4 w-4" />
              Clients must sign it to book online
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="resign" className="mt-1 h-4 w-4" />
              <span>This is an important change: ask every client to sign again</span>
            </label>
          </SimpleForm>
        </Card>
        {agreement && (
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Preview</p>
            <AgreementText title={agreement.title} body={agreement.body} />
          </Card>
        )}
      </Page>
    </>
  );
}
