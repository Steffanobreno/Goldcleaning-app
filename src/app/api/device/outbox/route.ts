import { businessForDeviceKey } from "@/lib/device";
import { monthlyMarketingReminder, queueDueMessages, sendQueuedEmails, takeSmsOutbox } from "@/lib/messaging";
import { processCampaigns } from "@/lib/data/marketing";

// Called by the owner's iPhone Shortcut (Automation, e.g. 10:00 and 18:00 every day).
// Returns the texts to send from the phone: { count, messages: [{ phone, body }] }.
// Each text is returned once; the Shortcut sends them with "Send Message".
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const business = await businessForDeviceKey(key);
  if (!business) return Response.json({ error: "Unknown key" }, { status: 401 });

  await queueDueMessages(business.id);
  await sendQueuedEmails(business.id);
  const messages = await takeSmsOutbox(business.id);
  // Email campaigns keep going a little each time the phone checks in (scheduled ones start here too).
  await processCampaigns(business.id, 8).catch(() => {});
  await monthlyMarketingReminder(business.id).catch(() => {});
  return Response.json(
    { count: messages.length, messages: messages.map((m) => ({ phone: m.phone, body: m.body })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
