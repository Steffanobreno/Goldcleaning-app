"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { emailConfigured, sendMany } from "@/lib/email";
import { phoneLabel, zonedToUtc } from "@/lib/format";
import { audience, cleanFilters, sendCampaignBatch, startCampaign, type Filters } from "@/lib/data/marketing";
import { fillVars, marketingEmailHtml, marketingEmailText } from "@/lib/marketing-email";
import { templateByKey } from "@/lib/marketing-templates";

export type CampaignState = { error?: string; saved?: boolean; sent?: string } | undefined;

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function own(id: string) {
  const staff = await requireStaff();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { staff, c: null };
  const [c] = await sql`select * from campaigns where id = ${id} and business_id = ${staff.businessId}`;
  return { staff, c: c ?? null };
}

export async function createCampaignAction(templateKey: string) {
  const staff = await requireStaff();
  const t = templateByKey(templateKey) ?? templateByKey("blank")!;
  const [c] = await sql`
    insert into campaigns (business_id, name, template, subject, preheader, banner, headline, body, button_label, filters)
    values (${staff.businessId}, ${t.name}, ${t.key}, ${t.subject}, ${t.preheader}, ${t.banner}, ${t.headline}, ${t.body}, ${t.button},
            ${sql.json(cleanFilters(t.filters))})
    returning id`;
  redirect(`/marketing/${c.id}`);
}

export async function saveCampaignAction(id: string, _: CampaignState, form: FormData): Promise<CampaignState> {
  const { c } = await own(id);
  if (!c) return { error: "Campaign not found." };
  if (c.status !== "draft" && c.status !== "scheduled") return { error: "This campaign was already sent." };
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const banner = text("banner", 300) || null;
  const buttonUrl = text("button_url", 500) || null;
  if (banner && !/^\/marketing\/[a-z0-9-]+\.jpg$/.test(banner)) return { error: "Pick a picture from the list." };
  if (buttonUrl && !/^https:\/\/\S+$/.test(buttonUrl)) return { error: "The button link must start with https://" };
  await sql`
    update campaigns set name = ${text("name", 120) || c.name}, subject = ${text("subject", 200)},
      preheader = ${text("preheader", 200)}, banner = ${banner},
      headline = ${text("headline", 200)}, body = ${text("body", 5000)}, button_label = ${text("button_label", 60) || null},
      button_url = ${buttonUrl}
    where id = ${id}`;
  revalidatePath(`/marketing/${id}`);
  if (form.get("next")) redirect(`/marketing/${id}?step=recipients`);
  return { saved: true };
}

/** How many clients the filters reach, with a few names (live, while filtering). */
export async function countAudienceAction(raw: Filters) {
  const staff = await requireStaff();
  const people = await audience(staff.businessId, cleanFilters(raw));
  const emails = new Set(people.map((p) => p.email));
  return { count: emails.size, sample: people.slice(0, 8).map((p) => `${p.first_name} ${p.last_name}`.trim()) };
}

export async function saveFiltersAction(id: string, raw: Filters) {
  const { c } = await own(id);
  if (!c || (c.status !== "draft" && c.status !== "scheduled")) return;
  await sql`update campaigns set filters = ${sql.json(cleanFilters(raw))} where id = ${id}`;
  redirect(`/marketing/${id}?step=send`);
}

/** Sends the campaign to the owner's own email, filled in with a sample client. */
export async function sendTestAction(id: string, _: CampaignState, form: FormData): Promise<CampaignState> {
  const { staff, c } = await own(id);
  if (!c) return { error: "Campaign not found." };
  if (!emailConfigured()) return { error: "Email isn't set up yet (Settings → Texts and email)." };
  const to = String(form.get("to") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) return { error: "Type the email to send the test to." };
  const [b] = await sql`select name, phone, mailing_address, website_url from businesses where id = ${staff.businessId}`;
  const vars = { first_name: "Alex", pet_name: "Luna", business: b.name, booking_link: `${appUrl()}/book` };
  const content = { preheader: c.preheader, banner: c.banner, headline: c.headline, body: c.body, buttonLabel: c.button_label, buttonUrl: c.button_url };
  const unsubscribeUrl = `${appUrl()}/marketing`;
  const [error] = await sendMany(b.name, [{
    to,
    subject: `[Test] ${fillVars(c.subject || c.name, vars)}`,
    html: marketingEmailHtml({ appUrl: appUrl(), content, vars, phone: phoneLabel(b.phone) || null, mailingAddress: b.mailing_address, unsubscribeUrl }),
    text: marketingEmailText({ content, vars, unsubscribeUrl, mailingAddress: b.mailing_address }),
  }]);
  return error ? { error: `Gmail said: ${error}` } : { sent: to };
}

async function readyToSend(id: string) {
  const { staff, c } = await own(id);
  if (!c) return { error: "Campaign not found." };
  if (c.status !== "draft" && c.status !== "scheduled") return { error: "This campaign was already sent." };
  if (!c.subject.trim()) return { error: "Write a subject first (step 1)." };
  if (!c.body.trim()) return { error: "Write the message first (step 1)." };
  if (!emailConfigured()) return { error: "Email isn't set up yet (Settings → Texts and email)." };
  const [b] = await sql`select mailing_address from businesses where id = ${staff.businessId}`;
  if (!b.mailing_address) return { error: "Add your mailing address on the Marketing page first (US law asks for it in marketing emails)." };
  const people = await audience(staff.businessId, cleanFilters(c.filters));
  if (people.length === 0) return { error: "No clients match these filters (step 2)." };
  return { staff, c };
}

export async function sendNowAction(id: string): Promise<CampaignState> {
  const r = await readyToSend(id);
  if ("error" in r) return { error: r.error };
  await startCampaign(id);
  await sendCampaignBatch(id, 6);
  revalidatePath("/marketing");
  redirect(`/marketing/${id}`);
}

export async function scheduleAction(id: string, _: CampaignState, form: FormData): Promise<CampaignState> {
  const r = await readyToSend(id);
  if ("error" in r) return { error: r.error };
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a day and a time." };
  const at = zonedToUtc(date, time, r.staff.timezone);
  if (at.getTime() < Date.now() + 5 * 60_000) return { error: "Pick a time later than now." };
  await sql`update campaigns set status = 'scheduled', scheduled_at = ${at} where id = ${id}`;
  revalidatePath("/marketing");
  redirect(`/marketing/${id}`);
}

export async function unscheduleAction(id: string) {
  const { c } = await own(id);
  if (c?.status === "scheduled") await sql`update campaigns set status = 'draft', scheduled_at = null where id = ${id}`;
  revalidatePath("/marketing");
  redirect(`/marketing/${id}?step=send`);
}

/** Called by the open campaign page to keep sending; returns how many are left. */
export async function sendNextBatchAction(id: string) {
  const { c } = await own(id);
  if (!c || c.status !== "sending") return 0;
  return sendCampaignBatch(id, 8);
}

export async function duplicateCampaignAction(id: string) {
  const { staff, c } = await own(id);
  if (!c) redirect("/marketing");
  const [copy] = await sql`
    insert into campaigns (business_id, name, template, subject, preheader, banner, headline, body, button_label, button_url, filters)
    values (${staff.businessId}, ${`${c.name} (copy)`}, ${c.template}, ${c.subject}, ${c.preheader}, ${c.banner}, ${c.headline}, ${c.body},
            ${c.button_label}, ${c.button_url}, ${sql.json(c.filters)})
    returning id`;
  redirect(`/marketing/${copy.id}`);
}

export async function deleteCampaignAction(id: string) {
  const { staff } = await own(id);
  await sql`delete from campaigns where id = ${id} and business_id = ${staff.businessId} and status in ('draft', 'scheduled')`;
  revalidatePath("/marketing");
  redirect("/marketing");
}

export async function setMarketingReminderAction(on: boolean) {
  const staff = await requireStaff();
  await sql`update businesses set marketing_reminder = ${on} where id = ${staff.businessId}`;
  revalidatePath("/marketing");
}

export async function saveMailingAddressAction(_: CampaignState, form: FormData): Promise<CampaignState> {
  const staff = await requireStaff();
  const address = String(form.get("mailing_address") ?? "").trim().slice(0, 200);
  if (address && address.length < 10) return { error: "Write the full address (street or PO box, city, state, ZIP)." };
  await sql`update businesses set mailing_address = ${address || null} where id = ${staff.businessId}`;
  revalidatePath("/marketing");
  return { saved: true };
}
