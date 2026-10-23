import type { Metadata } from "next";
import { getPublicBusiness, onlineServices } from "@/lib/booking";
import { activeAgreement } from "@/lib/agreement";
import { AgreementText } from "@/components/agreement-text";
import { ClientShell, StepCard } from "@/components/client-shell";
import { phoneLabel, todayYmd } from "@/lib/format";
import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = { title: "Book a visit", robots: { index: true } };
export const dynamic = "force-dynamic";

// ?embed=1 hides the header and footer, for showing this page inside the website.
export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const b = await getPublicBusiness();
  if (!b) return null;
  const { embed, phone: resumePhone } = await searchParams;
  const [services, agreement] = await Promise.all([onlineServices(b.id), activeAgreement(b.id)]);
  const phone = phoneLabel(b.phone);
  return (
    <ClientShell phone={b.phone} phoneLabel={phone} website={b.website_url} bare={embed === "1"}>
      {b.online_booking_enabled ? (
        <BookingWizard
          services={services}
          businessName={b.name}
          businessPhone={phone}
          today={todayYmd(b.timezone)}
          agreementTitle={agreement?.title ?? null}
          agreement={agreement?.required_online ? <AgreementText title={agreement.title} body={agreement.body} /> : null}
          initialPhone={typeof resumePhone === "string" ? resumePhone.replace(/\D/g, "").slice(-10) : ""}
        />
      ) : (
        <StepCard>
          <h1 className="text-2xl font-extrabold">Online booking is paused</h1>
          <p className="mt-2 text-muted">Please text us at {phone} and we&apos;ll find you a time.</p>
        </StepCard>
      )}
    </ClientShell>
  );
}
