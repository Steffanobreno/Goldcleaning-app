import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { Card, Page, PageHeader } from "@/components/ui";
import { createClientAction } from "../actions";
import { ClientForm } from "../forms";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New client" back="/clients" />
      <Page>
        <Card>
          <ClientForm action={createClientAction} submitLabel="Save and add a pet" />
        </Card>
      </Page>
    </>
  );
}
