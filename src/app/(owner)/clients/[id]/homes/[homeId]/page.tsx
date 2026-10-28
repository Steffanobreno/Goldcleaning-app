import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getHome } from "@/lib/data/homes";
import { Card, Page, PageHeader } from "@/components/ui";
import { archiveHomeAction, saveHomeAction } from "../../../actions";
import { HomeForm } from "../../../forms";
import { HomePrice } from "../../../home-price";

export const metadata: Metadata = { title: "Edit home" };

export default async function EditHomePage({ params }: PageProps<"/clients/[id]/homes/[homeId]">) {
  const staff = await requireStaff();
  const { id, homeId } = await params;
  const home = await getHome(staff, homeId);
  if (!home || home.client_id !== id) notFound();
  return (
    <>
      <PageHeader title={`Edit ${home.label}`} back={`/clients/${id}`} />
      <Page>
        <Card>
          <HomeForm action={saveHomeAction.bind(null, id, homeId)} initial={home} />
        </Card>
        <HomePrice businessId={staff.businessId} clientId={id} homeId={homeId} />
        {!home.archived_at && (
          <form action={archiveHomeAction.bind(null, id, homeId)} className="text-center">
            <button type="submit" className="text-sm font-semibold text-muted underline">
              The client no longer has this home
            </button>
            <p className="mt-1 text-xs text-muted">Hides it from booking. Past cleanings stay in the history.</p>
          </form>
        )}
      </Page>
    </>
  );
}
