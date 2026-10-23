import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fullName, getClient } from "@/lib/data/clients";
import { listHomes } from "@/lib/data/homes";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { saveHomeAction } from "../../../actions";
import { HomeForm } from "../../../forms";

export const metadata: Metadata = { title: "New home" };

export default async function NewHomePage({ params, searchParams }: PageProps<"/clients/[id]/homes/new">) {
  const staff = await requireStaff();
  const { id } = await params;
  const first = (await searchParams).first === "1";
  const client = await getClient(staff, id);
  if (!client) notFound();
  // The first home starts from the client's address.
  const hasHome = (await listHomes(staff, id)).length > 0;
  const initial = hasHome
    ? undefined
    : { address_line: client.address_line, city: client.city, state: client.state, zip: client.zip };
  return (
    <>
      <PageHeader title={`New home for ${fullName(client)}`} back={`/clients/${id}`} />
      <Page>
        {first && <Notice kind="success">Client saved. Now add the home we clean.</Notice>}
        <Card>
          <HomeForm action={saveHomeAction.bind(null, id, null)} initial={initial} offerBooking />
        </Card>
      </Page>
    </>
  );
}
