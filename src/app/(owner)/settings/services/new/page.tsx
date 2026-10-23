import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { listServices } from "@/lib/data/services";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveServiceAction } from "../../actions";
import { ServiceForm } from "../../forms";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  const staff = await requireStaff();
  const categories = [...new Set((await listServices(staff, { includeInactive: true })).map((s) => s.category).filter((c): c is string => !!c))];
  return (
    <>
      <PageHeader title="New service" back="/settings/services" />
      <Page>
        <Card>
          <ServiceForm action={saveServiceAction.bind(null, null)} categories={categories} />
        </Card>
      </Page>
    </>
  );
}
