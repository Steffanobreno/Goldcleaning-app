import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { allOptions, isOptionKind, OPTION_KINDS } from "@/lib/data/options";
import { Card, Empty, Page, PageHeader } from "@/components/ui";
import { addOptionAction, deleteOptionAction, moveOptionAction, renameOptionAction } from "../actions";
import { AddOption, OptionRow } from "../list-editor";

export const metadata: Metadata = { title: "Client lists" };

export default async function OptionListPage({ params }: PageProps<"/settings/lists/[kind]">) {
  const staff = await requireStaff();
  const { kind } = await params;
  if (!isOptionKind(kind)) notFound();
  const info = OPTION_KINDS[kind];
  const items = (await allOptions(staff.businessId))[kind];
  return (
    <>
      <PageHeader title={info.title} back="/settings/lists" />
      <Page>
        <p className="text-sm text-muted">{info.hint} Tap a name to rename it; clients that use it follow.</p>
        {items.length ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {items.map((o, i) => (
              <OptionRow key={o.id} label={o.label} first={i === 0} last={i === items.length - 1}
                rename={renameOptionAction.bind(null, o.id)}
                move={moveOptionAction.bind(null, "option_lists", o.id)}
                remove={deleteOptionAction.bind(null, o.id)} />
            ))}
          </ul>
        ) : (
          <Empty title={`No ${info.one}s yet`}>Add the first one below.</Empty>
        )}
        <Card>
          <AddOption action={addOptionAction.bind(null, kind)} placeholder={`New ${info.one}`} />
        </Card>
      </Page>
    </>
  );
}
