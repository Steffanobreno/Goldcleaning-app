import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { Button, Card } from "@/components/ui";
import { ClientShell } from "@/components/client-shell";
import { phoneLabel } from "@/lib/format";
import { unsubscribeAction } from "./actions";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false } };

// The link at the bottom of marketing emails. Opening it asks first (link scanners open
// links too); one tap unsubscribes. Visit reminders and confirmations keep coming.
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f]{24}$/.test(token)) notFound();
  const [c] = await sql<{ first_name: string; out: boolean; business: string; phone: string | null; website_url: string | null }[]>`
    select c.first_name, c.email_unsubscribed_at is not null as out, b.name as business, b.phone, b.website_url
    from clients c join businesses b on b.id = c.business_id where c.marketing_token = ${token}`;
  if (!c) notFound();
  return (
    <ClientShell phone={c.phone} phoneLabel={phoneLabel(c.phone)} website={c.website_url}>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <Card className="space-y-4 text-center">
          {c.out ? (
            <>
              <h1 className="text-xl font-bold">{sp.done ? "You're unsubscribed" : "You're not getting our news emails"}</h1>
              <p className="text-muted">
                No more promotions from {c.business}. You&apos;ll still get the confirmations and reminders for your visits.
              </p>
              <form action={unsubscribeAction.bind(null, token, true)}>
                <Button type="submit" kind="secondary" className="w-full">Changed my mind: subscribe again</Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{sp.back ? `Welcome back, ${c.first_name}!` : `Unsubscribe, ${c.first_name}?`}</h1>
              <p className="text-muted">
                {sp.back ? `You'll get news and offers from ${c.business} again.`
                  : `You'll stop getting news and offers from ${c.business}. Visit reminders still come.`}
              </p>
              {!sp.back && (
                <form action={unsubscribeAction.bind(null, token, false)}>
                  <Button type="submit" className="w-full">Unsubscribe</Button>
                </form>
              )}
            </>
          )}
        </Card>
      </main>
    </ClientShell>
  );
}
