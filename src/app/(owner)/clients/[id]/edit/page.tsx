import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import { phoneLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../forms";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const staff = await requireStaff();
  const { id } = await params;
  const client = await getClient(staff, id);
  if (!client) notFound();
  return (
    <>
      <PageHeader title="Edit client" back={`/clients/${id}`} />
      <Page>
        <Card>
          <ClientForm
            action={updateClientAction.bind(null, id)}
            submitLabel="Save changes"
            initial={{ ...client, phone: phoneLabel(client.phone), sms_consent: client.sms_consent_at != null }}
          />
        </Card>
      </Page>
    </>
  );
}
