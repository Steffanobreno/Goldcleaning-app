import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveDiscountAction } from "../../actions";
import { DiscountForm } from "../../forms";

export const metadata: Metadata = { title: "New discount" };

export default async function NewDiscountPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New discount" back="/settings/discounts" />
      <Page>
        <Card>
          <DiscountForm action={saveDiscountAction.bind(null, null)} />
        </Card>
      </Page>
    </>
  );
}
