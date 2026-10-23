import { formatInTimeZone } from "date-fns-tz";
import { getStaff } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";

// "Download a backup now" in Settings → Backups.
export async function GET() {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const stamp = formatInTimeZone(new Date(), staff.timezone, "yyyy-MM-dd");
  return new Response(JSON.stringify(await buildBackup(staff.businessId)), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="woofers-backup-${stamp}.json"`, "Cache-Control": "no-store" },
  });
}
