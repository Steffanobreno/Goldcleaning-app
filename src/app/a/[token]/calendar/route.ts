import { clientEvent } from "@/lib/client-calendar";

// The visit as an .ics file: on an iPhone, tapping the link opens "Add to Calendar".
export async function GET(_: Request, { params }: RouteContext<"/a/[token]/calendar">) {
  const { token } = await params;
  const e = /^[0-9a-f]{16,}$/.test(token) ? await clientEvent({ token }) : null;
  if (!e) return new Response("This visit can't be added to a calendar.", { status: 404 });
  return new Response(e.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="woofers-visit.ics"',
      "Cache-Control": "no-store",
    },
  });
}
