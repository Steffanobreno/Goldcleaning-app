import "server-only";
import { sql } from "./db";
import { emailConfigured, sendEmail } from "./email";
import { getReceipt, receiptUrl } from "./data/receipts";
import { receiptsPdf } from "./receipt-pdf";
import { money } from "./format";

export type ReceiptEmailResult = "sent" | "no-email" | "not-set-up" | "failed";

/**
 * Emails the client their receipt: a short note with the link, and the PDF attached.
 * `onlyOnce` skips it when it was already emailed (the automatic send when an order finishes).
 */
export async function emailReceipt(businessId: string, invoiceId: string, { onlyOnce = false } = {}): Promise<ReceiptEmailResult> {
  const r = await getReceipt({ invoiceId, businessId });
  if (!r) return "failed";
  if (onlyOnce && r.emailedAt) return "sent";
  if (!r.client.email) return "no-email";
  if (!emailConfigured()) return "not-set-up";
  const firstName = r.client.name.split(" ")[0];
  const paidWith = [...new Set(r.payments.map((p) => p.method))].join(" + ");
  const text = [
    `Hi ${firstName}! Thank you for choosing ${r.business.name}.`,
    "",
    `Receipt #${r.number}: ${money(r.paid)} paid${paidWith ? ` by ${paidWith}` : ""}${r.tips ? ` (incl. ${money(r.tips)} tip)` : ""}.`,
    r.total > r.paid ? `Balance due: ${money(r.total - r.paid)}.` : "",
    "",
    `See your receipt: ${receiptUrl(r.token)}`,
    "The PDF is attached.",
  ].filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n");
  try {
    const pdf = await receiptsPdf([r], `Receipt #${r.number}`);
    await sendEmail({
      to: r.client.email,
      subject: `Your receipt from ${r.business.name} (#${r.number})`,
      text,
      fromName: r.business.name,
      attachments: [{ filename: `gold-cleaning-receipt-${r.number}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
  } catch (e) {
    console.error("receipt email failed", e);
    return "failed";
  }
  await sql`update invoices set receipt_emailed_at = now() where id = ${invoiceId}`;
  return "sent";
}
