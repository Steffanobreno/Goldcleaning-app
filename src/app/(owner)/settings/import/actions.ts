"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { parseClientsCsv } from "@/lib/import/clients-csv";
import { writeClients, type ImportReport } from "@/lib/import/write-clients";

export type ImportState = { error?: string; report?: ImportReport & { skipped: string[] } } | undefined;

export async function importClientsAction(_: ImportState, form: FormData): Promise<ImportState> {
  const staff = await requireStaff();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the CSV file first." };
  if (file.size > 5_000_000) return { error: "That file is too big (over 5 MB)." };
  const { clients, problems } = parseClientsCsv(await file.text());
  if (clients.length === 0) return { error: problems[0] ?? "No clients found in that file." };
  let report: ImportReport;
  try {
    report = await writeClients(
      sql,
      { businessId: staff.businessId, staffId: staff.staffId, timezone: staff.timezone },
      clients,
      { appointments: form.get("appointments") === "on" },
    );
  } catch (e) {
    console.error("client import failed", e);
    return { error: `The import did not finish, nothing was saved. (${(e as Error).message.slice(0, 160)})` };
  }
  revalidatePath("/clients");
  revalidatePath("/calendar");
  return { report: { ...report, skipped: problems } };
}
