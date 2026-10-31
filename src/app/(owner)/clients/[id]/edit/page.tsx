import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import { allOptions, clientOptions, clientTagsFor } from "@/lib/data/options";
import { phoneLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../forms";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const staff = await requireStaff();
  const { id } = await params;
  const [client, lists, tags] = await Promise.all([getClient(staff, id), allOptions(staff.businessId), clientTagsFor([id])]);
  if (!client) notFound();
  return (
    <>
      <PageHeader title="Edit client" back={`/clients/${id}`} />
      <Page>
        <Card>
          <ClientForm
            action={updateClientAction.bind(null, id)}
            submitLabel="Save changes"
            options={clientOptions(lists)}
            initial={{ ...client, phone: phoneLabel(client.phone), tags: tags.get(id) ?? [] }}
          />
        </Card>
      </Page>
    </>
  );
}
