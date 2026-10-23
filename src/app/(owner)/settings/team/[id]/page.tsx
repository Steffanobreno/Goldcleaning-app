import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { GROOMER_COLORS, listGroomers } from "@/lib/data/staff";
import { phoneLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { updateGroomerAction } from "../actions";
import { GroomerForm } from "../groomer-form";

export const metadata: Metadata = { title: "Groomer" };

export default async function GroomerPage({ params }: PageProps<"/settings/team/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const g = (await listGroomers(staff)).find((x) => x.id === id);
  if (!g) notFound();
  return (
    <>
      <PageHeader title={g.name} back="/settings/team" />
      <Page>
        <Card>
          <GroomerForm action={updateGroomerAction.bind(null, id)} colors={GROOMER_COLORS} isOwner={g.role === "owner"} submit="Save"
            initial={{ name: g.name, color: g.color, phone: g.phone ? phoneLabel(g.phone) : "", email: g.email ?? "", active: g.active }} />
        </Card>
      </Page>
    </>
  );
}
