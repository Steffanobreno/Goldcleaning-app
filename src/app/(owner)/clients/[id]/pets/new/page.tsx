import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fullName, getClient } from "@/lib/data/clients";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { savePetAction } from "../../../actions";
import { PetForm } from "../../../forms";

export const metadata: Metadata = { title: "New pet" };

export default async function NewPetPage({ params, searchParams }: PageProps<"/clients/[id]/pets/new">) {
  const staff = await requireStaff();
  const { id } = await params;
  const first = (await searchParams).first === "1";
  const client = await getClient(staff, id);
  if (!client) notFound();
  return (
    <>
      <PageHeader title={`New pet for ${fullName(client)}`} back={`/clients/${id}`} />
      <Page>
        {first && <Notice kind="success">Client saved. Now add their pet.</Notice>}
        <Card>
          <PetForm action={savePetAction.bind(null, id, null)} offerBooking />
        </Card>
      </Page>
    </>
  );
}
