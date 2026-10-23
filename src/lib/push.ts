import "server-only";
import webpush from "web-push";
import { sql } from "./db";

// Pop-up notifications on the owner's phone (the app added to the Home Screen) and computer.
// Uses the browsers' own push service: free, no account. The signing keys are created the
// first time and kept in the business row.

export async function pushKeys(businessId: string) {
  const [b] = await sql<{ vapid_public: string | null; vapid_private: string | null }[]>`
    select vapid_public, vapid_private from businesses where id = ${businessId}`;
  if (b?.vapid_public && b.vapid_private) return { publicKey: b.vapid_public, privateKey: b.vapid_private };
  const keys = webpush.generateVAPIDKeys();
  // Another request may have made them at the same moment: keep whichever was saved first.
  const [saved] = await sql<{ vapid_public: string; vapid_private: string }[]>`
    update businesses set vapid_public = coalesce(vapid_public, ${keys.publicKey}),
                          vapid_private = coalesce(vapid_private, ${keys.privateKey})
    where id = ${businessId} returning vapid_public, vapid_private`;
  return { publicKey: saved.vapid_public, privateKey: saved.vapid_private };
}

/** Sends a notification to every device the owner turned notifications on for. */
export async function sendPush(businessId: string, message: { title: string; body: string; url?: string }) {
  const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    select id, endpoint, p256dh, auth from push_subscriptions where business_id = ${businessId}`;
  if (subs.length === 0) return 0;
  const { publicKey, privateKey } = await pushKeys(businessId);
  const subject = process.env.APP_URL?.startsWith("https://") ? process.env.APP_URL : "mailto:owner@example.com";
  const payload = JSON.stringify(message);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 60 * 60 * 24,
        });
        sent++;
      } catch (e) {
        // Gone or expired: the phone turned notifications off or the app was removed.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sql`delete from push_subscriptions where id = ${s.id}`;
      }
    }),
  );
  return sent;
}
