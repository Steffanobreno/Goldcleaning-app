// Fills the {braces} in a message template. Pure, shared by the sender and the previews.
//
// Variables: {client}, {business}, {date}, {time}, {service}, {home} ("3 bd / 2 ba"), {total},
// {appointment_url} (the client's page to see, confirm or cancel; {link} is the same),
// {booking_url}, {review_url}, {business_phone}. An unknown {name} is left as is, so a typo
// shows up in the preview instead of disappearing.

export type TemplateVars = Partial<
  Record<
    | "client" | "business" | "date" | "time" | "service" | "home" | "total"
    | "appointment_url" | "link" | "booking_url" | "review_url" | "business_phone",
    string | number | null
  >
> & Record<string, string | number | null | undefined>;

export function renderTemplate(body: string, vars: TemplateVars) {
  const all: Record<string, string | number | null | undefined> = { ...vars };
  // {link} and {appointment_url} are the same page; either name works.
  all.link ??= vars.appointment_url;
  all.appointment_url ??= vars.link;
  return body.replace(/\{(\w+)\}/g, (match, key: string) => (all[key] != null ? String(all[key]) : match));
}
