import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { phoneLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { saveBusinessAction } from "../actions";
import { BusinessForm } from "../forms";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessPage() {
  const staff = await requireStaff();
  return (
    <>
      <PageHeader title="Business" back="/settings" />
      <Page>
        <Card>
          <BusinessForm
            action={saveBusinessAction}
            initial={{
              name: staff.businessName,
              phone: phoneLabel(staff.businessPhone),
              booking_slug: staff.bookingSlug,
              owner_name: staff.staffName,
            }}
          />
        </Card>
      </Page>
    </>
  );
}
