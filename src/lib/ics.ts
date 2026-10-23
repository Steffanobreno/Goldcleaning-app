// iCalendar (.ics) helpers (RFC 5545): the owner's calendar feed and the "add to my calendar"
// file sent to clients both use these.

export const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
export const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Lines longer than 75 octets must be folded.
export function icsFold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  updated: Date;
  title: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  alarmsMinutesBefore?: number[]; // reminders on the client's phone
};

export function icsEventLines(e: IcsEvent) {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsStamp(e.updated)}`,
    `DTSTART:${icsStamp(e.start)}`,
    `DTEND:${icsStamp(e.end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(e.alarmsMinutesBefore ?? []).flatMap((m) => [
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, `TRIGGER:-PT${m}M`, "END:VALARM",
    ]),
    "END:VEVENT",
  ];
}

export function icsCalendar(name: string, timezone: string, events: string[][]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Woofers//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(name)}`,
    `X-WR-TIMEZONE:${timezone}`,
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link: opens Google Calendar with the event filled in. */
export function googleCalendarLink(e: Pick<IcsEvent, "start" | "end" | "title" | "location" | "description">) {
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", e.title);
  u.searchParams.set("dates", `${icsStamp(e.start)}/${icsStamp(e.end)}`);
  if (e.location) u.searchParams.set("location", e.location);
  if (e.description) u.searchParams.set("details", e.description);
  return u.toString();
}
