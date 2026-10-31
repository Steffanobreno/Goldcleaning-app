import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { allOptions, clientOptions } from "@/lib/data/options";
import { Card, Page, PageHeader } from "@/components/ui";
import { createClientAction } from "../actions";
import { ClientForm } from "../forms";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  const staff = await requireStaff();
  const lists = await allOptions(staff.businessId);
  return (
    <>
      <PageHeader title="New client" back="/clients" />
      <Page>
        <Card>
          <ClientForm action={createClientAction} submitLabel="Save and add the home" options={clientOptions(lists)} />
        </Card>
      </Page>
    </>
  );
}
