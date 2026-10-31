import { getStaff } from "@/lib/auth";
import { isYmd, zonedToUtc, addDaysYmd } from "@/lib/format";
import { getReceipt, listReceipts } from "@/lib/data/receipts";
import { receiptsPdf } from "@/lib/receipt-pdf";

// Every paid receipt between two days, one per page, in a single PDF.
export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!isYmd(from) || !isYmd(to) || to < from) return new Response("Pick the days.", { status: 400 });
  const list = await listReceipts(staff.businessId, zonedToUtc(from, "00:00", staff.timezone), zonedToUtc(addDaysYmd(to, 1), "00:00", staff.timezone));
  if (list.length > 500) return new Response("Too many receipts at once: pick a shorter period.", { status: 400 });
  const receipts = (await Promise.all(list.map((r) => getReceipt({ invoiceId: r.id, businessId: staff.businessId })))).filter((r) => !!r);
  const pdf = await receiptsPdf(receipts, `Receipts ${from} to ${to}`);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gold-cleaning-receipts-${from}-to-${to}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
