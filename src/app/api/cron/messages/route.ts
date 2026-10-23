import { runMessagingJobs } from "@/lib/messaging";

// Hourly job (Hostinger cron or GitHub Actions) so emails go out even when the phone is off.
// Call with header "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await runMessagingJobs();
  return Response.json({ ok: true });
}
