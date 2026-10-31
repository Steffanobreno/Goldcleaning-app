import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Two ways to send, picked by what is set on the server:
// - Resend (RESEND_API_KEY + EMAIL_FROM, an address on the business's own domain): lands in the
//   inbox more often, 3,000 a month free. Replies go to GMAIL_USER when it is set.
// - Gmail with an App Password (GMAIL_USER + GMAIL_APP_PASSWORD): free, about 500 a day.
// Without either, email is simply not sent.

let transport: Transporter | null = null;

const resendOn = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
const gmailOn = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
export const emailConfigured = () => resendOn() || gmailOn();
/** The address clients see emails from, for the settings page. */
export const emailSender = () => (resendOn() ? process.env.EMAIL_FROM!.trim() : process.env.GMAIL_USER?.trim() ?? null);

type Mail = {
  to: string; subject: string; text: string; html: string; headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer | string; contentType: string }[];
};

// Tests point this at a local fake.
const resendUrl = (path: string) => `${(process.env.RESEND_API_URL ?? "https://api.resend.com").replace(/\/$/, "")}${path}`;

const resendBody = (fromName: string, m: Mail) => ({
  from: `${fromName.replace(/[<>"]/g, "")} <${process.env.EMAIL_FROM!.trim()}>`,
  to: [m.to],
  subject: m.subject,
  text: m.text,
  html: m.html,
  ...(process.env.GMAIL_USER ? { reply_to: process.env.GMAIL_USER.trim() } : {}),
  ...(m.headers ? { headers: m.headers } : {}),
  ...(m.attachments?.length
    ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64"), content_type: a.contentType })) }
    : {}),
});

async function resendPost(path: string, body: unknown) {
  const res = await fetch(resendUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Resend refused it (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Gmail; SMTP_HOST / SMTP_PORT point the tests at a local mail catcher instead.
function smtpServer() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return { host: process.env.SMTP_HOST ?? "smtp.gmail.com", port, secure: port === 465 };
}

function getTransport() {
  if (!gmailOn()) return null;
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
  totalLabel?: string; // "Estimated" by default; "Total paid" on the thank-you email
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
${d.total ? row(d.totalLabel ?? "Estimated", `<strong>${escape(d.total)}</strong>`) : ""}
</table></div>
${d.link ? `<p style="margin:24px 0 0;text-align:center"><a href="${d.link}" style="display:inline-block;background:#0b1f3b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${d.badge === "Waiting for confirmation" ? "See my request" : "See, confirm or cancel"}</a></p>` : ""}
${d.calendar ? `<p style="margin:16px 0 0;text-align:center;font-size:14px;color:#5b6474">Add it to your calendar so you don't forget:</p>
<p style="margin:8px 0 0;text-align:center">${calButton(d.calendar.apple, "Apple / iPhone")} ${calButton(d.calendar.google, "Google Calendar")}</p>` : ""}
${d.policy ? `<p style="margin:18px 0 0;color:#5b6474;font-size:13px">${escape(d.policy)}</p>` : ""}
${d.businessPhone ? `<p style="margin:8px 0 0;color:#5b6474;font-size:13px">Questions? Call or text us at <a href="tel:${escape(d.businessPhone)}" style="color:#0b1f3b">${escape(d.businessPhone)}</a>.</p>` : ""}`;
}

/** What goes with the message besides the appointment card: one big button and the footer lines. */
export type EmailExtras = {
  cta?: { label: string; url: string } | null;
  footer?: { phone?: string | null; address?: string | null } | null;
};

const appBase = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const BUTTONS: Partial<Record<string, string>> = {
  review_request: "Leave a Google review",
  abandoned_booking: "Finish my booking",
  rebook: "Book my next cleaning",
  cancelled: "Book again",
  request_declined: "Pick another time",
};

/**
 * The big button for emails that are mostly one link (review, finish booking, rebook...): the
 * first link in the message. The link stays in the words too, for apps that hide buttons.
 */
export function ctaFor(trigger: string | null, text: string): EmailExtras["cta"] {
  const label = trigger ? BUTTONS[trigger] : null;
  const url = label ? text.match(/https?:\/\/[^\s<]+/)?.[0] : null;
  return label && url ? { label, url } : null;
}

/**
 * The Gold Cleaning email: the logo on a navy band, the message, then (for appointment emails) a
 * card with the date, address, price lines, total and a button to see, confirm or cancel;
 * the business name, address and phone at the bottom. Inline styles only, since email apps
 * ignore style sheets.
 */
export function emailHtml(text: string, fromName: string, details?: EmailDetails | null, extras?: EmailExtras | null) {
  const link = details ? null : text.match(/https?:\/\/\S+\/a\/[0-9a-f]+/)?.[0];
  // With the card, the raw link in the text is redundant: the button opens it.
  const shown = details?.link ? text.replace(/\s*(See or change it here:|Please confirm or cancel here:)?\s*https?:\/\/\S+\/a\/[0-9a-f]+\S*/g, "") : text;
  const body = escape(shown)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0b1f3b;word-break:break-all">$1</a>')
    .replace(/\n/g, "<br>");
  const header = `<div style="background:#0b1f3b;padding:24px 24px 20px;text-align:center">
<img src="${appBase()}/logo.png" width="84" height="84" alt="Gold Cleaning" style="display:block;margin:0 auto 4px;border:0">
<p style="margin:0;font-family:Georgia,serif;font-weight:700;letter-spacing:5px;font-size:12px;color:#d9b45a">PENINSULA&nbsp;GOLD&nbsp;CLEANING</p>
</div><div style="height:4px;background:#c6a45e"></div>`;
  const button = link
    ? `<p style="margin:24px 0 0;text-align:center"><a href="${link}" style="display:inline-block;background:#0b1f3b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">See my appointment</a></p>`
    : extras?.cta
      ? `<p style="margin:24px 0 0;text-align:center"><a href="${escape(extras.cta.url)}" style="display:inline-block;background:#0b1f3b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${escape(extras.cta.label)}</a></p>`
      : "";
  const f = extras?.footer;
  return `<div style="background:#f5f4f0;padding:24px 12px;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;color:#0b1f3b;font-size:16px;line-height:1.55">
${header}
<div style="padding:28px 24px"><div>${body}</div>${details ? detailsHtml(details) + (details.link ? "" : button) : button}</div>
</div>
<p style="max-width:520px;margin:16px auto 0;text-align:center;color:#5b6474;font-size:13px;line-height:1.6">${escape(fromName)} · House cleaning on the Peninsula and the South Bay${f?.address ? `<br>${escape(f.address)}` : ""}${f?.phone ? `<br><a href="tel:${escape(f.phone)}" style="color:#5b6474">${escape(f.phone)}</a>` : ""}<br><a href="https://peninsulagoldcleaning.com" style="color:#5b6474">peninsulagoldcleaning.com</a></p>
</div>`;
}

export async function sendEmail({
  to, subject, text, fromName, details, extras, attachments = [],
}: {
  to: string; subject: string; text: string; fromName: string; details?: EmailDetails | null; extras?: EmailExtras | null;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}) {
  const mail: Mail = {
    to, subject, text, html: emailHtml(text, fromName, details, extras),
    // Gmail and Apple Mail show the attached visit with an "Add to calendar" option.
    attachments: [
      ...(details?.calendar
        ? [{ filename: "gold-cleaning.ics", content: details.calendar.ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }]
        : []),
      ...attachments,
    ],
  };
  if (resendOn()) {
    await resendPost("/emails", resendBody(fromName, mail));
    return;
  }
  const t = getTransport();
  if (!t) throw new Error("Email is not set up (RESEND_API_KEY + EMAIL_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD).");
  await t.sendMail({ from: { name: fromName, address: process.env.GMAIL_USER!.trim() }, ...mail });
}

/**
 * Sends several emails over one connection (marketing campaigns). Returns, for each email,
 * null when it was sent or the error message.
 */
export async function sendMany(
  fromName: string,
  mails: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }[],
) {
  if (!emailConfigured()) throw new Error("Email is not set up (RESEND_API_KEY + EMAIL_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD).");
  if (resendOn()) {
    // Up to 100 per request; one failed request marks its whole group as failed.
    const out: (string | null)[] = [];
    for (let i = 0; i < mails.length; i += 100) {
      const group = mails.slice(i, i + 100);
      try {
        await resendPost("/emails/batch", group.map((m) => resendBody(fromName, m)));
        out.push(...group.map(() => null));
      } catch (e) {
        out.push(...group.map(() => String((e as Error).message).slice(0, 500)));
      }
    }
    return out;
  }
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
