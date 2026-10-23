// The marketing email: logo, the campaign picture, headline, message, a big button, and the
// footer US law asks for (business name, mailing address, unsubscribe link). Plain functions,
// used for the live preview in the editor and for sending.

export type CampaignContent = {
  preheader?: string | null; // the grey line next to the subject in the inbox
  banner: string | null; // "/marketing/halloween.jpg"
  headline: string;
  body: string;
  buttonLabel: string | null;
  buttonUrl: string | null;
};

export type MarketingVars = { first_name: string; pet_name: string; business: string; booking_link: string };

export const fillVars = (text: string, v: MarketingVars) =>
  text.replace(/\{(first_name|pet_name|business|booking_link)\}/g, (_, k: keyof MarketingVars) => v[k]);

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function marketingEmailHtml({ appUrl, content, vars, phone, mailingAddress, unsubscribeUrl }: {
  appUrl: string;
  content: CampaignContent;
  vars: MarketingVars;
  phone: string | null;
  mailingAddress: string | null;
  unsubscribeUrl: string;
}) {
  const body = escape(fillVars(content.body, vars))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0a84cc">$1</a>')
    .replace(/\n/g, "<br>");
  const button = content.buttonLabel
    ? `<p style="margin:26px 0 6px;text-align:center"><a href="${escape(content.buttonUrl || vars.booking_link)}" style="display:inline-block;background:#e8452c;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:15px 34px;border-radius:999px">${escape(fillVars(content.buttonLabel, vars))}</a></p>`
    : "";
  const banner = content.banner
    ? `<img src="${escape(content.banner.startsWith("http") ? content.banner : appUrl + content.banner)}" width="520" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:16px;margin:0 0 22px">`
    : "";
  // Hidden text the inbox shows after the subject; the spaces keep the email body from showing after it.
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(fillVars(content.preheader, vars))}${"&#8199;&#65279;&#847; ".repeat(40)}</div>`
    : "";
  return `${preheader}<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:24px 20px;color:#132039;font-size:16px;line-height:1.6">
<img src="${escape(appUrl)}/logo.png" width="110" alt="${escape(vars.business)}" style="display:block;margin:0 auto 16px;border:0">
${banner}
${content.headline ? `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25">${escape(fillVars(content.headline, vars))}</h1>` : ""}
<div>${body}</div>
${button}
</div>
<p style="max-width:560px;margin:16px auto 0;text-align:center;color:#5d6b80;font-size:12px;line-height:1.6">
${escape(vars.business)} · Mobile dog grooming in the Bay Area${phone ? ` · ${escape(phone)}` : ""}<br>
${mailingAddress ? `${escape(mailingAddress)}<br>` : ""}
You get this email because you're a client of ${escape(vars.business)}. <a href="${escape(unsubscribeUrl)}" style="color:#5d6b80">Unsubscribe</a>
</p>
</div>`;
}

export function marketingEmailText({ content, vars, unsubscribeUrl, mailingAddress }: {
  content: CampaignContent; vars: MarketingVars; unsubscribeUrl: string; mailingAddress: string | null;
}) {
  return [
    content.headline && fillVars(content.headline, vars),
    fillVars(content.body, vars),
    content.buttonLabel && `${fillVars(content.buttonLabel, vars)}: ${content.buttonUrl || vars.booking_link}`,
    "—",
    [vars.business, mailingAddress].filter(Boolean).join(", "),
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter(Boolean).join("\n\n");
}
