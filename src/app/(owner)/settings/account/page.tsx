import type { Metadata } from "next";
import { accountEmail, requireStaff } from "@/lib/auth";
import { Button, Card, Field, Input, Page, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { logoutAction } from "@/app/login/actions";
import { SimpleForm } from "../forms";
import { changePasswordAction, logoutOthersAction, saveAccountAction, savePinAction } from "./actions";
import { sql } from "@/lib/db";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const staff = await requireStaff();
  const [email, [pinRow]] = await Promise.all([
    accountEmail(staff.staffId),
    sql<{ has: boolean }[]>`select pin_hash is not null as has from staff where id = ${staff.staffId}`,
  ]);
  const hasPin = !!pinRow?.has;
  return (
    <>
      <PageHeader title="Account" back="/settings" />
      <Page>
        <Card>
          <SimpleForm action={saveAccountAction}>
            <Field label="Your name">
              <Input name="name" defaultValue={staff.staffName} required autoComplete="name" />
            </Field>
            <Field label="Login email" hint="You log in with it. Not shown to clients.">
              <Input name="email" type="email" defaultValue={email ?? ""} required autoComplete="email" />
            </Field>
          </SimpleForm>
        </Card>
        <section className="space-y-2">
          <h2 className="section-label">Password</h2>
          <Card>
            <SimpleForm action={changePasswordAction} submitLabel="Change password" savedLabel="Password changed. Other devices were logged out.">
              <Field label="Current password">
                <Input name="current" type="password" required autoComplete="current-password" />
              </Field>
              <Field label="New password" hint="At least 10 characters.">
                <Input name="password" type="password" required minLength={10} autoComplete="new-password" />
              </Field>
              <Field label="New password again">
                <Input name="confirm" type="password" required minLength={10} autoComplete="new-password" />
              </Field>
            </SimpleForm>
          </Card>
        </section>
        <section className="space-y-2">
          <h2 className="section-label">App lock</h2>
          <Card className="space-y-3">
            <p className="text-sm text-muted">
              {hasPin
                ? "On. The app asks for your PIN when you open it again, or after 5 minutes away."
                : "Ask for a PIN when the app is opened again on your phone, so nobody else can look at your clients."}
            </p>
            <SimpleForm action={savePinAction} submitLabel={hasPin ? "Change PIN" : "Turn on app lock"} savedLabel="Saved.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="PIN (4 to 6 numbers)"><Input name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" required autoComplete="off" /></Field>
                <Field label="PIN again"><Input name="pin_again" type="password" inputMode="numeric" pattern="\d{4,6}" required autoComplete="off" /></Field>
              </div>
            </SimpleForm>
            {hasPin && (
              <form action={async (f: FormData) => { "use server"; f.set("remove", "1"); await savePinAction(undefined, f); }}>
                <Button type="submit" kind="ghost" className="w-full">Turn off app lock</Button>
              </form>
            )}
          </Card>
        </section>
        <section className="space-y-2">
          <h2 className="section-label">Devices</h2>
          <Card className="space-y-3">
            <p className="text-sm text-muted">Lost a phone, or logged in on someone else&apos;s computer? Log out everywhere but here.</p>
            <form action={logoutOthersAction}>
              <ConfirmButton question="Log out every other phone and computer?" className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-bg">
                Log out other devices
              </ConfirmButton>
            </form>
            <form action={logoutAction}>
              <Button type="submit" kind="danger" className="w-full">Log out</Button>
            </form>
          </Card>
        </section>
      </Page>
    </>
  );
}
