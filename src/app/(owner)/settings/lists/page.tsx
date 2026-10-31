import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { allOptions, OPTION_KINDS, type OptionKind } from "@/lib/data/options";
import { Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Client lists" };

const KINDS: OptionKind[] = ["client_tag", "referral_source"];

export default async function ListsPage() {
  const staff = await requireStaff();
  const lists = await allOptions(staff.businessId);
  return (
    <>
      <PageHeader title="Client lists" back="/settings" />
      <Page>
        <ul className="card divide-y divide-line overflow-hidden">
          {KINDS.map((k) => (
            <li key={k}>
              <Link href={`/settings/lists/${k}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{OPTION_KINDS[k].title}</div>
                  <div className="truncate text-sm text-muted">{lists[k].length ? lists[k].map((o) => o.label).join(", ") : "None yet"}</div>
                </div>
                <span aria-hidden className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}
