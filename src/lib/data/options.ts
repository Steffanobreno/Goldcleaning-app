import "server-only";
import { sql } from "../db";

// The owner's own lists for clients. Each list starts with sensible defaults.

export const OPTION_KINDS = {
  client_tag: { title: "Client tags", one: "tag", hint: "Mark clients: VIP, great tipper, has a pet, key in lockbox…" },
  referral_source: { title: "Referral sources", one: "source", hint: "How clients found you. Pick it on the client." },
} as const;
export type OptionKind = keyof typeof OPTION_KINDS;
export const isOptionKind = (k: unknown): k is OptionKind => typeof k === "string" && k in OPTION_KINDS;

const DEFAULTS: Record<OptionKind, string[]> = {
  client_tag: ["VIP", "Great tipper", "Has pets", "Key or code on file", "Airbnb host", "Pays late"],
  referral_source: ["Google", "Instagram", "Facebook", "Yelp", "Nextdoor", "Friend or family", "Website", "Flyer or QR code"],
};

async function seedOnce(businessId: string) {
  await sql.begin(async (tx) => {
    const [b] = await tx`update businesses set options_seeded = true
                         where id = ${businessId} and not options_seeded returning id`;
    if (!b) return;
    for (const [kind, labels] of Object.entries(DEFAULTS)) {
      for (const [i, label] of labels.entries()) {
        await tx`insert into option_lists (business_id, kind, label, sort_order)
                 values (${businessId}, ${kind}, ${label}, ${i}) on conflict do nothing`;
      }
    }
  });
}

export type Option = { id: string; label: string };

/** Every list of the business, in the owner's order. */
export async function allOptions(businessId: string): Promise<Record<OptionKind, Option[]>> {
  await seedOnce(businessId);
  const rows = await sql<{ id: string; kind: OptionKind; label: string }[]>`
    select id, kind, label from option_lists where business_id = ${businessId} order by kind, sort_order, label`;
  const out = Object.fromEntries(Object.keys(OPTION_KINDS).map((k) => [k, [] as Option[]])) as unknown as Record<OptionKind, Option[]>;
  for (const r of rows) out[r.kind].push({ id: r.id, label: r.label });
  return out;
}

export async function optionLabels(businessId: string, kind: OptionKind) {
  return (await allOptions(businessId))[kind].map((o) => o.label);
}

/** The options the client form offers. */
export function clientOptions(lists: Record<OptionKind, Option[]>) {
  return { tags: lists.client_tag.map((o) => o.label), sources: lists.referral_source.map((o) => o.label) };
}

/** Each client's tags, as a map client id → labels. */
export async function clientTagsFor(clientIds: string[]) {
  const out = new Map<string, string[]>();
  if (!clientIds.length) return out;
  const rows = await sql<{ client_id: string; label: string }[]>`
    select client_id, label from client_tags where client_id = any(${clientIds}) order by label`;
  for (const r of rows) out.set(r.client_id, [...(out.get(r.client_id) ?? []), r.label]);
  return out;
}
