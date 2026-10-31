import { getReceipt } from "@/lib/data/receipts";
import { receiptsPdf } from "@/lib/receipt-pdf";

// The client's receipt as a PDF (the link is the key, like /a/<token>).
export async function GET(req: Request, { params }: RouteContext<"/r/[token]/pdf">) {
  const { token } = await params;
  const r = /^[0-9a-f]{32}$/.test(token) ? await getReceipt({ token }) : null;
  if (!r) return new Response("Receipt not found.", { status: 404 });
  const pdf = await receiptsPdf([r], `Receipt #${r.number}`);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="gold-cleaning-receipt-${r.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
