import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ButtonLink, Card, Page, PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import and export clients" };

export default async function ImportPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Import and export" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Export</h2>
          <p className="text-sm text-muted">
            Download every client with their pets, address, last and next visit as a spreadsheet (CSV). Keep a copy as a backup;
            it can also be imported back here.
          </p>
          <ButtonLink href="/api/export/clients" kind="secondary" className="w-full" prefetch={false}>
            Download client list (CSV)
          </ButtonLink>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Import</h2>
          <p className="text-sm text-muted">
            Upload the client list exported from your old app. Clients are matched by phone number, so importing the same file
            twice does not create duplicates. Pets come with their breed and grooming frequency; set each pet&apos;s size when you
            see them.
          </p>
          <ImportForm />
        </Card>
      </Page>
    </>
  );
}
