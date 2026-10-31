import type { Receipt } from "@/lib/data/receipts";
import { receiptUrl } from "@/lib/data/receipts";
import { dayLabel, timeLabel } from "@/lib/format";
import { Notice } from "@/components/ui";
import { ShareReceiptButton } from "@/components/share-receipt";

const RESULT: Record<string, string> = {
  sent: "Receipt emailed.",
  "no-email": "This client has no email on file. Add one on their profile.",
  "not-set-up": "Email isn't set up yet (Settings → Email messages).",
  failed: "The email didn't go out. Try again in a minute.",
};

/** Ways to get a receipt to the client: share the PDF, send the link, email it, download it. */
export function ReceiptActions({ r, emailAction, result }: {
  r: Receipt;
  emailAction: () => Promise<void>;
  result?: string; // ?receipt= after "Email receipt"
}) {
  const tz = r.business.timezone;
  const text = `Here's your receipt from ${r.business.name}. Thank you! ${receiptUrl(r.token)}`;
  return (
    <section className="space-y-2" aria-label="Receipt">
      <h2 className="section-label px-1">Receipt #{r.number}</h2>
      {result && RESULT[result] && <Notice kind={result === "sent" ? "success" : "warn"}>{RESULT[result]}</Notice>}
      <div className="card space-y-3 p-4">
        <p className="text-sm text-muted">
          {r.emailedAt
            ? `Emailed to ${r.client.email} on ${dayLabel(r.emailedAt, tz)} ${timeLabel(r.emailedAt, tz)}.`
            : r.client.email
              // The receipt goes out right after the payment, in the background.
              ? (r.justClosed ? `Sending to ${r.client.email}…` : "Not emailed yet.")
              : "No email on file for this client."}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <ShareReceiptButton pdfUrl={`/r/${r.token}/pdf`} fileName={`gold-cleaning-receipt-${r.number}.pdf`}
            className="col-span-2 rounded-full bg-brand py-3 text-white">
            Share PDF
          </ShareReceiptButton>
          {r.client.phone && (
            <a href={`sms:${r.client.phone}&body=${encodeURIComponent(text)}`} className="rounded-full border-2 border-brand py-2.5 text-center text-brand">
              Text the link
            </a>
          )}
          <form action={emailAction} className="contents">
            <button type="submit" className="rounded-full border-2 border-brand py-2.5 text-brand">
              {r.emailedAt ? "Email again" : "Email receipt"}
            </button>
          </form>
          <a href={`/r/${r.token}/pdf?download=1`} className="rounded-full border-2 border-line py-2.5 text-center">Download PDF</a>
        </div>
        <a href={`/r/${r.token}`} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-brand">
          See the client&apos;s receipt page
        </a>
      </div>
    </section>
  );
}
