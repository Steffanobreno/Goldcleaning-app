import { sql } from "@/lib/db";

// One-click unsubscribe (RFC 8058): Gmail and Apple Mail POST here from their own
// "Unsubscribe" button. Opening the link in a browser goes to the page that asks first.
export async function POST(_: Request, { params }: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await params;
  if (/^[0-9a-f]{24}$/.test(token)) {
    await sql`update clients set email_unsubscribed_at = coalesce(email_unsubscribed_at, now()) where marketing_token = ${token}`;
  }
  return new Response("Unsubscribed", { status: 200 });
}

export async function GET(request: Request, { params }: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await params;
  return Response.redirect(new URL(`/u/${token}`, request.url), 303);
}
