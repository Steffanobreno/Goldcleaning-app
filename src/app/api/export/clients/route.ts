import { formatInTimeZone } from "date-fns-tz";
import { getStaff } from "@/lib/auth";
import { clientsCsv } from "@/lib/clients-csv";

export async function GET() {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const csv = await clientsCsv(staff.businessId, staff.timezone);
  const stamp = formatInTimeZone(new Date(), staff.timezone, "yyyy-MM-dd");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="woofers-clients-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
