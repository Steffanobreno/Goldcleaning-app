import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { LoginForm } from "../login/login-form";

export const metadata: Metadata = { title: "Set up" };

// Must check the database on every visit, never at build time.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Welcome</h1>
      <p className="mb-6 text-muted">Create the owner login. You only do this once.</p>
      <Card>
        <LoginForm mode="setup" />
      </Card>
    </main>
  );
}
