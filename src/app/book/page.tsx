import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/booking";
import { ClientShell, StepCard } from "@/components/client-shell";
import { phoneLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Book a cleaning", robots: { index: true } };
export const dynamic = "force-dynamic";

// ?embed=1 hides the header and footer, for showing this page inside the website.
// The booking steps come next (service, frequency, home, extras, time, address, access).
export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const b = await getPublicBusiness();
  if (!b) return null;
  const { embed } = await searchParams;
  const phone = phoneLabel(b.phone);
  return (
    <ClientShell phone={b.phone} phoneLabel={phone} website={b.website_url} bare={embed === "1"}>
      <StepCard>
        <h1 className="text-2xl font-extrabold">Online booking is coming soon</h1>
        <p className="mt-2 text-muted">Please call or text us at {phone} and we&apos;ll find you a time.</p>
      </StepCard>
    </ClientShell>
  );
}
