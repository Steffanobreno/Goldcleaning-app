import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { backupScript } from "@/lib/backup-script";
import { ButtonLink, Card, Notice, Page, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";

export const metadata: Metadata = { title: "Backups" };

export default async function BackupsPage() {
  const staff = await requireStaff();
  const [b] = await sql<{ backup_key: string; backup_at: Date | null; stale: boolean }[]>`
    select backup_key, backup_at, coalesce(backup_at < now() - interval '8 days', true) as stale
    from businesses where id = ${staff.businessId}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const script = backupScript(`${appUrl}/api/device/backup?key=${b.backup_key}`, staff.timezone);
  const when = b.backup_at?.toLocaleString("en-US", { timeZone: staff.timezone, dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader title="Backups" back="/settings" />
      <Page>
        <Card className="space-y-3">
          <h2 className="font-bold">Weekly backup to Google Drive</h2>
          {!b.backup_at ? (
            <Notice kind="warn">Not set up yet. Follow the steps below once.</Notice>
          ) : b.stale ? (
            <Notice kind="warn">The last backup was on {when}, more than a week ago. Check the script on script.google.com.</Notice>
          ) : (
            <Notice kind="success">Working. Last backup: {when}.</Notice>
          )}
          <p className="text-sm text-muted">
            Every Sunday night a free script in the Woofers Google account saves a copy of everything (clients, pets, visits,
            payments, messages, settings) in a &quot;Woofers backups&quot; folder on Google Drive, plus the client list as a
            spreadsheet. It keeps the last 12 weeks. This copy is separate from the app&apos;s database.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>On the iPad or a computer, open <strong>script.google.com</strong> with the Woofers Google account (on the iPad: Safari → <strong>aA</strong> → <strong>Request Desktop Website</strong>).</li>
            <li>Tap <strong>New project</strong>. Use a new one, not the Google Calendar one.</li>
            <li>Delete what is in the editor and paste the script below (<strong>Copy</strong>).</li>
            <li>Tap <strong>Save</strong> (disk icon). In the bar at the top choose <strong>setup</strong>, then <strong>Run</strong>.</li>
            <li>Google asks for permission: <strong>Review permissions</strong> → the Woofers account → <strong>Advanced → Go to Untitled project</strong> → <strong>Allow</strong>.</li>
            <li>Open <strong>Google Drive</strong>: the &quot;Woofers backups&quot; folder has today&apos;s two files. Come back here: it says &quot;Working&quot;.</li>
          </ol>
          <CopyField label="Backup script (keep it private: it has your key)" value={script} multiline />
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">Download a copy now</h2>
          <p className="text-sm text-muted">The same file the weekly backup saves, to keep wherever you like.</p>
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href="/api/export/backup" kind="secondary" prefetch={false}>Everything (JSON)</ButtonLink>
            <ButtonLink href="/api/export/clients" kind="secondary" prefetch={false}>Clients (spreadsheet)</ButtonLink>
          </div>
        </Card>
        <p className="px-1 text-xs text-muted">Not in the backup: passwords, pet photos and drawn signatures (the typed name and date are kept).</p>
      </Page>
    </>
  );
}
