import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/booking";
import { loadCatalog } from "@/lib/data/catalog";
import { ClientShell, StepCard } from "@/components/client-shell";
import { phoneLabel, todayYmd } from "@/lib/format";
import { BookingPage } from "./booking-page";

export const metadata: Metadata = { title: "Book a cleaning", robots: { index: true } };
export const dynamic = "force-dynamic";

// ?embed=1 hides the header and footer, for showing this page inside the website.
export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const b = await getPublicBusiness();
  if (!b) return null;
  const { embed, phone: resume } = await searchParams;
  const phone = phoneLabel(b.phone);
  return (
    <ClientShell phone={b.phone} phoneLabel={phone} website={b.website_url} bare={embed === "1"}>
      {b.online_booking_enabled ? (
        <BookingPage initialCatalog={await loadCatalog(b.id, { onlineOnly: true })} today={todayYmd(b.timezone)} businessPhone={phone}
          // The "finish booking" email links back here with the phone they typed.
          initialPhone={typeof resume === "string" ? resume.replace(/\D/g, "").slice(-10) : ""} />
      ) : (
        <StepCard>
          <h1 className="text-2xl font-extrabold">Online booking is paused</h1>
          <p className="mt-2 text-muted">Please call or text us at {phone} and we&apos;ll find you a time.</p>
        </StepCard>
      )}
    </ClientShell>
  );
}
