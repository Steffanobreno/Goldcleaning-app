import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { GROOMER_COLORS, listGroomers } from "@/lib/data/staff";
import { phoneLabel } from "@/lib/format";
import { Card, Page, PageHeader } from "@/components/ui";
import { ChevronRight } from "@/components/icons";
import { addGroomerAction } from "./actions";
import { GroomerForm } from "./groomer-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const staff = await requireStaff();
  const team = await listGroomers(staff);
  return (
    <>
      <PageHeader title="Team" back="/settings" />
      <Page>
        <ul className="card divide-y divide-line overflow-hidden">
          {team.map((g) => (
            <li key={g.id}>
              <Link href={`/settings/team/${g.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-bg ${g.active ? "" : "opacity-50"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: g.color }}>
                  {g.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{g.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {g.role === "owner" ? "Owner" : g.active ? "Groomer" : "Not active"}{g.phone ? ` · ${phoneLabel(g.phone)}` : ""}
                  </span>
                </span>
                <ChevronRight size={20} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <Card className="space-y-3">
          <h2 className="font-bold">Add a groomer</h2>
          <p className="text-sm text-muted">
            Each groomer gets their own color and their own route on Today. When booking, you choose who does the visit.
            They start with your working hours.
          </p>
          <GroomerForm action={addGroomerAction} colors={GROOMER_COLORS} submit="Add groomer" />
        </Card>
        <p className="px-1 text-xs text-muted">
          For now groomers don&apos;t log in: you book and manage their visits. Online booking requests come to you, and you can
          assign them to anyone.
        </p>
      </Page>
    </>
  );
}
