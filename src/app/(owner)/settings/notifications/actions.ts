"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { sendPush } from "@/lib/push";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves this phone (or computer) so it gets notifications. */
export async function savePushSubscriptionAction(sub: Sub, device: string) {
  const staff = await requireStaff();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "This browser didn't give a notification address." };
  await sql`
    insert into push_subscriptions (business_id, staff_id, endpoint, p256dh, auth, device)
    values (${staff.businessId}, ${staff.staffId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${device.slice(0, 80)})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, business_id = excluded.business_id`;
  revalidatePath("/settings/notifications");
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string) {
  const staff = await requireStaff();
  await sql`delete from push_subscriptions where endpoint = ${endpoint} and business_id = ${staff.businessId}`;
  revalidatePath("/settings/notifications");
}

export async function testPushAction() {
  const staff = await requireStaff();
  const sent = await sendPush(staff.businessId, {
    title: "Woofers Dog Spa",
    body: "Notifications are on. You'll hear about new bookings, cancellations and reschedule requests here. 🐾",
    url: "/today",
  });
  return { sent };
}
