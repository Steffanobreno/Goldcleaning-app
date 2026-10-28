import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listDiscounts } from "@/lib/data/discounts";
import { discountLabel } from "@/lib/pricing";
import { toDef } from "@/lib/data/discounts";
import { ButtonLink, Card, Empty, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  const staff = await requireStaff();
  const rows = await listDiscounts(staff.businessId);
  return (
    <>
      <PageHeader title="Discounts" back="/settings" action={<ButtonLink href="/settings/discounts/new">Add</ButtonLink>} />
      <Page>
        <p className="px-1 text-sm text-muted">
          A discount with a <strong>code</strong> is a coupon: clients type it on the booking page (it can be for first-time clients
          only). A discount <strong>without a code</strong> is yours to give: to one cleaning when you book it, or to a client&apos;s
          home so it always applies (open the client → the home → Price for this home).
        </p>
        {rows.length === 0 ? (
          <Empty title="No discounts yet">Add one, like a 10% first-cleaning coupon.</Empty>
        ) : (
          <ul className="space-y-3">
            {rows.map((d) => (
              <li key={d.id}>
                <Link href={`/settings/discounts/${d.id}`}>
                  <Card className={`space-y-1 ${d.active ? "" : "opacity-60"}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{discountLabel(toDef(d))}</span>
                      <span className="text-xs text-muted">{d.active ? "On" : "Off"}</span>
                    </div>
                    <p className="text-sm text-muted">
                      {d.code ? (
                        <>
                          Code <span className="font-mono font-semibold text-ink">{d.code}</span>
                          {d.first_time_only ? " · first-time clients" : ""}
                        </>
                      ) : (
                        "Given by you, no code"
                      )}
                      {d.max_uses ? ` · used ${d.uses} of ${d.max_uses}` : d.uses ? ` · used ${d.uses}` : ""}
                      {d.starts_on || d.ends_on ? ` · ${d.starts_on ?? "…"} to ${d.ends_on ?? "…"}` : ""}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
