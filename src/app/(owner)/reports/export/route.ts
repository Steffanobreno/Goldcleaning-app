import { getStaff } from "@/lib/auth";
import { report } from "@/lib/data/reports";
import { reportDetails } from "@/lib/data/report-details";
import { todayYmd } from "@/lib/format";
import { reportPeriod } from "@/lib/report-period";
import { reportCsv, reportPdf } from "@/lib/report-export";

// Reports as a download, for the same period as the page: ?format=pdf or ?format=csv (Excel).
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { from, to, group } = reportPeriod(sp, todayYmd(staff.timezone));
  const [r, d] = await Promise.all([report(staff, from, to, group), reportDetails(staff, from, to)]);
  const file = { business: staff.businessName, from, to, group, r, d };
  const name = `gold-cleaning-report-${from}-to-${to}`;
  if (sp.format === "csv") {
    return new Response(reportCsv(file), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(Buffer.from(await reportPdf(file)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
