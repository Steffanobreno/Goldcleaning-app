import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { clientCounts, fullAddress, fullName, listClients } from "@/lib/data/clients";
import { phoneLabel } from "@/lib/format";
import { ButtonLink, Empty, Notice, Page, PageHeader } from "@/components/ui";
import { ClientFinder } from "@/components/client-finder";
import { clientTagsFor, optionLabels } from "@/lib/data/options";
import { TagChips } from "@/components/chips";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const q = String(sp.q ?? "");
  const inactive = sp.show === "inactive";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const [clients, counts, tagList] = await Promise.all([listClients(staff, q, inactive, tag), clientCounts(staff), optionLabels(staff.businessId, "client_tag")]);
  const tags = await clientTagsFor(clients.map((c) => c.id));
  return (
    <>
      <PageHeader title="Clients" action={<ButtonLink href="/clients/new">New client</ButtonLink>} />
      <Page>
        {tagList.length > 0 && (
          <nav aria-label="Filter by tag" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {["", ...tagList].map((t) => (
              <Link key={t || "all"} href={`/clients?${[inactive && "show=inactive", t && `tag=${encodeURIComponent(t)}`].filter(Boolean).join("&")}`}
                aria-current={t === tag ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${t === tag ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
                {t || "All"}
              </Link>
            ))}
          </nav>
        )}
        <p className="px-1 text-sm text-muted">
          CLIENTS <strong className="text-ink">{counts.clients}</strong> · HOMES <strong className="text-ink">{counts.homes}</strong>
          {q && <> · {clients.length} found</>}
          <Link href={inactive ? "/clients" : "/clients?show=inactive"} className="float-right font-semibold text-brand">
            {inactive ? "Active clients" : "Inactive clients"}
          </Link>
        </p>
        {inactive && <p className="px-1 text-sm font-semibold">Inactive clients</p>}
        {sp.removed && <Notice kind="success">Client removed.</Notice>}
        {clients.length === 0 ? (
          <Empty title={q ? "No client matches that search" : inactive ? "No inactive clients" : "No clients yet"}>
            {q ? "Try part of the name, the phone number, the street or the ZIP." : "Add your first client to start booking."}
          </Empty>
        ) : (
          <ClientFinder initialQuery={q} placeholder="Search by name, phone or address" form={<>{inactive && <input type="hidden" name="show" value="inactive" />}{tag && <input type="hidden" name="tag" value={tag} />}</>}>
          <ul className="space-y-2">
            {clients.map((c) => (
              <li key={c.id} data-letter={c.first_name} data-search={[fullName(c), c.phone, c.home_summary, c.city, fullAddress(c)].filter(Boolean).join(" ")}>
                <Link href={`/clients/${c.id}`} className="card flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {(c.first_name[0] ?? "") + (c.last_name?.[0] ?? "")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{fullName(c)}</span>
                      {c.is_new && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
                      <TagChips tags={tags.get(c.id)} />
                    </span>
                    <span className="block truncate text-sm">
                      {c.home_summary ? <span className="font-medium">{c.home_summary}</span> : <span className="text-muted">No home yet</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{[phoneLabel(c.phone), c.city ?? fullAddress(c)].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </ClientFinder>
        )}
      </Page>
    </>
  );
}
