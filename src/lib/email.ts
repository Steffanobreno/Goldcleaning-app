import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Sends through the business Gmail account with an App Password (free, about 500/day).
// Set GMAIL_USER and GMAIL_APP_PASSWORD. Without them, email is simply not sent.

let transport: Transporter | null = null;

export const emailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

// Gmail; SMTP_HOST / SMTP_PORT point the tests at a local mail catcher instead.
function smtpServer() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return { host: process.env.SMTP_HOST ?? "smtp.gmail.com", port, secure: port === 465 };
}

function getTransport() {
  if (!emailConfigured()) return null;
  transport ??= nodemailer.createTransport({
    ...smtpServer(),
    // Google shows app passwords as "abcd efgh ijkl mnop"; pasted with the spaces (or a stray
    // line break) they are refused, so keep only the letters.
    auth: { user: process.env.GMAIL_USER?.trim(), pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
  });
  return transport;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The appointment card shown under the message in appointment emails. */
export type EmailDetails = {
  heading: string;
  badge: string | null; // e.g. "Waiting for confirmation"
  when: string;
  address: string | null;
  lines: { name: string; price: string }[]; // the price lines: service, extra rooms, extras
  total: string; // "" when no prices are set
  link: string | null;
  businessPhone: string | null;
  policy: string | null;
  // "Add to my calendar" buttons, and the .ics file attached to the email.
  calendar?: { apple: string; google: string; ics: string } | null;
};

const row = (label: string, value: string) =>
  `<tr><td style="padding:10px 0;border-top:1px solid #e4e2dc;color:#5b6474;font-size:13px;width:90px;vertical-align:top">${label}</td><td style="padding:10px 0;border-top:1px solid #e4e2dc;font-size:15px">${value}</td></tr>`;

const calButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin:4px;border:2px solid #0b1f3b;color:#0b1f3b;text-decoration:none;font-weight:700;font-size:14px;padding:10px 16px;border-radius:999px">📅 ${label}</a>`;

function detailsHtml(d: EmailDetails) {
  const lines = d.lines
    .map((l) => `<span style="color:#5b6474">${escape(l.name)}</span> &nbsp;${escape(l.price)}`)
    .join("<br>");
  return `<div style="margin-top:24px;border:1px solid #e4e2dc;border-radius:16px;padding:18px 18px 8px">
<p style="margin:0 0 4px;font-size:20px;font-weight:800">${escape(d.heading)}</p>
${d.badge ? `<p style="margin:0 0 10px"><span style="display:inline-block;background:#f3ead7;color:#6b5420;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">${escape(d.badge)}</span></p>` : ""}
<table role="presentation" style="width:100%;border-collapse:collapse">
${row("When", `<strong>${escape(d.when)}</strong>`)}
${d.address ? row("Where", escape(d.address)) : ""}
${lines ? row("Cleaning", lines) : ""}
${d.total ? row("Estimated", `<strong>${escape(d.total)}</strong>`) : ""}
</table></div>
${d.link ? `<p style="margin:24px 0 0;text-align:center"><a href="${d.link}" style="display:inline-block;background:#0b1f3b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${d.badge === "Waiting for confirmation" ? "See my request" : "See, confirm or cancel"}</a></p>` : ""}
${d.calendar ? `<p style="margin:16px 0 0;text-align:center;font-size:14px;color:#5b6474">Add it to your calendar so you don't forget:</p>
<p style="margin:8px 0 0;text-align:center">${calButton(d.calendar.apple, "Apple / iPhone")} ${calButton(d.calendar.google, "Google Calendar")}</p>` : ""}
${d.policy ? `<p style="margin:18px 0 0;color:#5b6474;font-size:13px">${escape(d.policy)}</p>` : ""}
${d.businessPhone ? `<p style="margin:8px 0 0;color:#5b6474;font-size:13px">Questions? Call or text us at <a href="tel:${escape(d.businessPhone)}" style="color:#0b1f3b">${escape(d.businessPhone)}</a>.</p>` : ""}`;
}

/**
 * The Gold Cleaning email: the name on top, the message, then (for appointment emails) a card with
 * the date, address, price lines, total and a button to see, confirm or cancel; the
 * business name at the bottom. Inline styles only, since email apps ignore style sheets.
 */
export function emailHtml(text: string, fromName: string, details?: EmailDetails | null) {
  const link = details ? null : text.match(/https?:\/\/\S+\/a\/[0-9a-f]+/)?.[0];
  // With the card, the raw link in the text is redundant: the button opens it.
  const shown = details?.link ? text.replace(/\s*(See or change it here:|Please confirm or cancel here:)?\s*https?:\/\/\S+\/a\/[0-9a-f]+\S*/g, "") : text;
  const body = escape(shown)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0b1f3b;word-break:break-all">$1</a>')
    .replace(/\n/g, "<br>");
  const logo = `<p style="margin:0 0 16px;text-align:center;font-family:Georgia,serif;font-weight:700;letter-spacing:4px;font-size:14px;color:#0b1f3b">GOLD&nbsp;CLEANING</p>`;
  const button = link
    ? `<p style="margin:24px 0 0;text-align:center"><a href="${link}" style="display:inline-block;background:#0b1f3b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">See my appointment</a></p>`
    : "";
  return `<div style="background:#f5f4f0;padding:24px 12px;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px 24px;color:#0b1f3b;font-size:16px;line-height:1.55">
${logo}<div>${body}</div>${details ? detailsHtml(details) : button}
</div>
<p style="max-width:520px;margin:16px auto 0;text-align:center;color:#5b6474;font-size:13px">${escape(fromName)} · House cleaning on the Peninsula and the South Bay</p>
</div>`;
}

export async function sendEmail({
  to, subject, text, fromName, details,
}: { to: string; subject: string; text: string; fromName: string; details?: EmailDetails | null }) {
  const t = getTransport();
  if (!t) throw new Error("Email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD).");
  await t.sendMail({
    from: { name: fromName, address: process.env.GMAIL_USER!.trim() }, to, subject, text, html: emailHtml(text, fromName, details),
    // Gmail and Apple Mail show the attached visit with an "Add to calendar" option.
    attachments: details?.calendar
      ? [{ filename: "gold-cleaning.ics", content: details.calendar.ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }]
      : undefined,
  });
}

/**
 * Sends several emails over one connection (marketing campaigns). Returns, for each email,
 * null when it was sent or the error message.
 */
export async function sendMany(
  fromName: string,
  mails: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }[],
) {
  if (!emailConfigured()) throw new Error("Email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD).");
  const pool = nodemailer.createTransport({
    pool: true,
    maxConnections: 1,
    ...smtpServer(),
    auth: { user: process.env.GMAIL_USER?.trim(), pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
  });
  const from = { name: fromName, address: process.env.GMAIL_USER!.trim() };
  try {
    const out: (string | null)[] = [];
    for (const m of mails) {
      try {
        await pool.sendMail({ from, ...m });
        out.push(null);
      } catch (e) {
        out.push(String((e as Error).message).slice(0, 500));
      }
    }
    return out;
  } finally {
    pool.close();
  }
}
