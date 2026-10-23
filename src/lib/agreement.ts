import "server-only";
import { headers } from "next/headers";
import type { TransactionSql } from "postgres";
import { sql } from "./db";

export type Agreement = { id: string; title: string; body: string; version: number; required_online: boolean };

export async function activeAgreement(businessId: string) {
  const [a] = await sql<Agreement[]>`
    select id, title, body, version, required_online from agreements
    where business_id = ${businessId} and active order by created_at desc limit 1`;
  return a ?? null;
}

/** The client's latest signature of the current version within the last year, if any. */
export async function currentSignature(agreement: Agreement, clientId: string) {
  const [s] = await sql<{ signed_at: Date; signed_name: string; signature_url: string | null }[]>`
    select signed_at, signed_name, signature_url from agreement_signatures
    where agreement_id = ${agreement.id} and agreement_version = ${agreement.version} and client_id = ${clientId}
      and signed_at > now() - interval '365 days'
    order by signed_at desc limit 1`;
  return s ?? null;
}

/** A drawn signature from the booking page: a small PNG as a data URL, or null if it isn't one. */
export function signatureImage(dataUrl: unknown) {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,") && dataUrl.length < 300_000 ? dataUrl : null;
}

export async function recordSignature(
  tx: TransactionSql | typeof sql,
  agreement: Agreement,
  clientId: string,
  name: string,
  drawn: string | null = null,
) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  await tx`insert into agreement_signatures (agreement_id, agreement_version, client_id, signed_name, signature_url, ip)
           values (${agreement.id}, ${agreement.version}, ${clientId}, ${name.slice(0, 120)}, ${drawn}, ${ip})`;
}
