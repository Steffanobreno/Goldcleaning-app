import { sql } from "@/lib/db";
import { businessForDeviceKey } from "@/lib/device";
import { icsCalendar, icsEventLines } from "@/lib/ics";

// Calendar feed of the visits. Two formats:
// - iCalendar (default): Google Calendar → Other calendars → From URL. Google refreshes it on
//   its own schedule (usually every few hours).
// - JSON (?format=json): read every 15 minutes by the Google Apps Script shown in
//   Settings → Google Calendar, which copies the visits into a real Google calendar.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const business = await businessForDeviceKey(url.searchParams.get("key"));
  if (!business) return new Response("Unknown key", { status: 401 });

  const rows = await sql<
    { id: string; start_at: Date; end_at: Date; status: string; address_line: string | null; notes: string | null;
      client: string; phone: string; summary: string | null; zip: string | null; detail: string | null; updated_at: Date; groomer: string | null }[]
  >`
    select a.id, a.start_at, a.end_at, a.status, a.address_line, a.zip, a.notes, a.updated_at,
           trim(c.first_name || ' ' || c.last_name) as client, c.phone,
           (select st.name from staff st where st.id = a.staff_id and st.role <> 'owner') as groomer,
           -- "Regular Clean 3bd/2ba"
           (select concat_ws(' ', sv.name, h.bedrooms || 'bd/' || h.full_baths || 'ba')
            from appointment_homes ah join homes h on h.id = ah.home_id left join services sv on sv.id = a.service_id
            where ah.appointment_id = a.id order by ah.created_at limit 1) as summary,
           -- The price lines, one per line, then the access: "Lockbox · 1234"
           (select string_agg(l.name || case when l.qty > 1 then ' × ' || l.qty else '' end, E'\n' order by l.created_at, l.id)
            from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
            where ah.appointment_id = a.id) as detail
    from appointments a join clients c on c.id = a.client_id
    where a.business_id = ${business.id}
      and a.start_at > now() - interval '30 days' and a.start_at < now() + interval '180 days'
      and a.status in ('requested', 'unconfirmed', 'confirmed', 'en_route', 'in_progress', 'completed')
    order by a.start_at`;

  // Blocked time shows up too, so the Google calendar shows when the team is busy.
  const blocks = await sql<{ id: string; start_at: Date; end_at: Date; reason: string | null; updated_at: Date }[]>`
    select t.id, t.start_at, t.end_at, t.reason, t.updated_at
    from time_off t join staff s on s.id = t.staff_id
    where s.business_id = ${business.id} and t.end_at > now() - interval '30 days' and t.start_at < now() + interval '180 days'
    order by t.start_at`;
  const blockTitle = (t: (typeof blocks)[number]) => `Blocked${t.reason ? `: ${t.reason}` : ""}`;

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  // "Ana Silva · Regular Clean 3bd/2ba", so the week reads at a glance.
  const titleOf = (r: (typeof rows)[number]) =>
    `${r.status === "requested" ? "[Request] " : ""}${r.client}${r.summary ? ` · ${r.summary}` : ""}${r.groomer ? ` (${r.groomer})` : ""}`;
  const descriptionOf = (r: (typeof rows)[number]) =>
    [r.detail, r.phone, r.notes, appUrl && `Open in the app: ${appUrl}/appointments/${r.id}`,
     "Make changes in the Gold Cleaning app: changes made here are overwritten at the next sync."]
      .filter(Boolean).join("\n\n");

  if (url.searchParams.get("format") === "json") {
    await sql`update businesses set calendar_synced_at = now() where id = ${business.id}`;
    return Response.json(
      {
        from: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        to: new Date(Date.now() + 180 * 86_400_000).toISOString(),
        events: rows.map((r) => ({
          id: r.id,
          version: `${r.updated_at.toISOString()}|${r.status}`,
          title: titleOf(r),
          start: r.start_at.toISOString(),
          end: r.end_at.toISOString(),
          location: [r.address_line, r.zip].filter(Boolean).join(" "),
          description: descriptionOf(r),
        })).concat(blocks.map((t) => ({
          id: `block-${t.id}`,
          version: t.updated_at.toISOString(),
          title: blockTitle(t),
          start: t.start_at.toISOString(),
          end: t.end_at.toISOString(),
          location: "",
          description: "Blocked time in the Gold Cleaning app.",
        }))),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = icsCalendar(business.name, business.timezone, [
    ...rows.map((r) => icsEventLines({
      uid: `${r.id}@goldcleaning`, start: r.start_at, end: r.end_at, updated: r.updated_at, title: titleOf(r),
      location: r.address_line ? [r.address_line, r.zip].filter(Boolean).join(" ") : null, description: descriptionOf(r),
    })),
    ...blocks.map((t) => icsEventLines({
      uid: `block-${t.id}@goldcleaning`, start: t.start_at, end: t.end_at, updated: t.updated_at, title: blockTitle(t),
    })),
  ]);
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
