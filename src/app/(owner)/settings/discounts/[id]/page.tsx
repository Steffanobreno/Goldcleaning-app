import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { listDiscounts } from "@/lib/data/discounts";
import { Card, Page, PageHeader } from "@/components/ui";
import { deleteDiscountAction, saveDiscountAction } from "../../actions";
import { DiscountForm } from "../../forms";

export const metadata: Metadata = { title: "Edit discount" };

export default async function EditDiscountPage({ params }: PageProps<"/settings/discounts/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const d = (await listDiscounts(staff.businessId)).find((x) => x.id === id);
  if (!d) notFound();
  return (
    <>
      <PageHeader title="Edit discount" back="/settings/discounts" />
      <Page>
        <Card>
          <DiscountForm
            action={saveDiscountAction.bind(null, id)}
            initial={{
              name: d.name, code: d.code, kind: d.kind, value: d.kind === "percent" ? String(Number(d.percent)) : ((d.amount_cents ?? 0) / 100).toFixed(2),
              first_time_only: d.first_time_only, starts_on: d.starts_on, ends_on: d.ends_on, max_uses: d.max_uses, active: d.active,
            }}
          />
        </Card>
        <form action={deleteDiscountAction.bind(null, id)} className="text-center">
          <button type="submit" className="text-sm font-semibold text-muted underline">Delete this discount</button>
          <p className="mt-1 text-xs text-muted">Visits that used it keep their price.</p>
        </form>
      </Page>
    </>
  );
}
