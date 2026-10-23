import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { pushKeys } from "@/lib/push";
import { Card, Notice, Page, PageHeader } from "@/components/ui";
import { PushSetup } from "./push-setup";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const staff = await requireStaff();
  const [{ publicKey }, devices, [b]] = await Promise.all([
    pushKeys(staff.businessId),
    sql<{ device: string | null; created_at: Date }[]>`
      select device, created_at from push_subscriptions where business_id = ${staff.businessId} order by created_at`,
    sql<{ email: string | null }[]>`select email from businesses where id = ${staff.businessId}`,
  ]);
  return (
    <>
      <PageHeader title="Notifications" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Pop-ups on your phone</h2>
          <p className="text-sm text-muted">
            You get a notification when a client books online, confirms, cancels or asks for a different time. Tap it to open
            that visit.
          </p>
          <PushSetup publicKey={publicKey} />
          {devices.length > 0 && (
            <p className="text-xs text-muted">
              On for: {devices.map((d) => d.device ?? "Device").join(", ")}
            </p>
          )}
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">Email</h2>
          {b.email && emailConfigured() ? (
            <Notice kind="success">The same alerts also go to {b.email}.</Notice>
          ) : (
            <Notice kind="warn">Add your email in Texts and email to get these alerts by email too.</Notice>
          )}
        </Card>
      </Page>
    </>
  );
}
