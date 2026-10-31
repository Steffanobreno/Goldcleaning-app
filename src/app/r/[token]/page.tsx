import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReceipt } from "@/lib/data/receipts";
import { phoneLabel } from "@/lib/format";
import { ClientShell, StepCard } from "@/components/client-shell";
import { ReceiptView } from "@/components/receipt-view";
import { ShareReceiptButton } from "@/components/share-receipt";
import { getI18n } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n";

export const metadata: Metadata = { title: "Your receipt", robots: { index: false } };

// The client's receipt, from the link in the email. The token is the only key.
export default async function ClientReceiptPage({ params, searchParams }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const { lang, t } = await getI18n((await searchParams).lang);
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();
  const r = await getReceipt({ token });
  if (!r) notFound();
  return (
    <ClientShell phone={r.business.phone} phoneLabel={phoneLabel(r.business.phone)} website="https://peninsulagoldcleaning.com" i18n={{ lang, t }}>
      <StepCard>
        <ReceiptView r={r} t={t} locale={LOCALES[lang]} />
        <div className="mt-6 grid grid-cols-2 gap-2">
          <a href={`/r/${token}/pdf?download=1`} className="rounded-full border-2 border-brand py-3 text-center font-bold text-brand">
            {t("Download PDF")}
          </a>
          <ShareReceiptButton pdfUrl={`/r/${token}/pdf`} fileName={`gold-cleaning-receipt-${r.number}.pdf`} busyLabel={t("Preparing…")}
            className="rounded-full bg-brand py-3 text-center font-bold text-white">
            {t("Share")}
          </ShareReceiptButton>
        </div>
      </StepCard>
    </ClientShell>
  );
}
