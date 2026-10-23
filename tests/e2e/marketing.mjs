// Email marketing, end to end, against a local mail catcher (no real email).
// Run after slice.mjs and tests/e2e/marketing-seed.sql, with the server's
// SMTP_HOST/SMTP_PORT pointing at a catcher that appends each email as a JSON line to MAIL_LOG.
// Mailing address → pick "We miss you" → edit → filters recount → test email → send → every email
// has the client's name, the address and an unsubscribe link → unsubscribing leaves the list.
// Usage: MAIL_LOG=/path/mails.jsonl node tests/e2e/marketing.mjs [baseUrl] [screenshotDir]
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
const LOG = process.env.MAIL_LOG;
if (!LOG) throw new Error("Set MAIL_LOG");
mkdirSync(SHOTS, { recursive: true });
const mails = () => (existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const before = mails().length;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const count = async () => {
  await page.waitForTimeout(700);
  return Number(await page.locator('[aria-live="polite"]').textContent());
};

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await page.goto(`${BASE}/marketing`);
// No address comes preset for Gold Cleaning: the page asks for it first.
await page.getByRole("heading", { name: "Your mailing address" }).waitFor();
await page.getByLabel("Mailing address").fill("PO Box 123, Redwood City, CA 94063");
await page.getByRole("button", { name: "Save address" }).click();
await page.getByText("Mailing address in the emails").waitFor(); // the first-time card goes away
await page.getByText("Suggested this month").waitFor();
await page.getByRole("switch", { name: "Monthly reminder" }).waitFor();
step("mailing address saved; monthly suggestion and reminder switch shown");

await page.goto(`${BASE}/marketing/new`);
await shot("marketing-templates");
await page.getByText("Suggested now").waitFor();
await page.getByRole("button", { name: /We miss you/ }).first().click();
await page.waitForURL(/\/marketing\/[0-9a-f-]+$/);
if ((await page.locator('input[name="subject"]').inputValue()) !== "It's been a while, {first_name} ✨") fail("template subject not filled");
if ((await page.locator('input[name="preheader"]').inputValue()) !== "Your home deserves a fresh start.") fail("preview text not filled");
await page.fill('input[name="headline"]', "Fresh start, fresh home!");
const preview = page.frameLocator('iframe[title="Email preview"]');
await preview.getByText("Fresh start, fresh home!").waitFor();
await shot("marketing-editor");
await page.getByRole("button", { name: /Next: who gets it/ }).click();
await page.waitForURL(/step=recipients/);
step("'We miss you' template → edit with live preview → next");

// "We miss you" starts with "nothing booked yet"; widen it to everyone.
await page.getByRole("combobox").nth(1).selectOption("any");
const all = await count();
if (all !== 4) fail(`expected 4 clients with email (Ben has none, Eve unsubscribed), got ${all}`);
await page.getByRole("combobox").first().selectOption("over");
await page.getByRole("button", { name: "60 days" }).click();
if ((await count()) !== 1) fail("over 60 days should be just Bella");
await page.getByRole("combobox").first().selectOption("never");
const never = await count();
await page.getByRole("combobox").first().selectOption("any");
await page.getByRole("button", { name: /Redwood City/ }).click();
if ((await count()) !== 2) fail("Redwood City should be Bella and Carl");
await page.getByRole("button", { name: "All cities" }).click();
if ((await count()) !== 4) fail("back to everyone");
await shot("marketing-audience");
step(`filters recount: all 4, over 60 days 1, never visited ${never}, Redwood City 2`);

await page.getByRole("button", { name: /Next: send/ }).click();
await page.waitForURL(/step=send/);
await page.getByLabel("Test email").fill("owner@example.com");
await page.getByRole("button", { name: "Send test" }).click();
await page.getByText(/Sent to owner@example.com/).waitFor();
const test = mails().slice(before).find((m) => m.subject?.startsWith("[Test]"));
if (!test || !test.html.includes("Fresh start, fresh home!") || !test.html.includes("Alex")) fail("test email missing or wrong");
if (!test.html.includes("Your home deserves a fresh start.")) fail("preview text missing from the email");
step("test email arrives with the sample client");

await page.getByRole("button", { name: "Send now" }).click();
await page.getByRole("button", { name: "Yes, send" }).click();
await page.waitForURL(/\/marketing\/[0-9a-f-]+$/);
await page.getByText(/^Sent on /).waitFor({ timeout: 60_000 });
await shot("marketing-sent");
const sent = mails().slice(before).filter((m) => !m.subject?.startsWith("[Test]") && /Fresh start, fresh home!/.test(m.html ?? ""));
if (sent.length !== 4) fail(`expected 4 campaign emails, got ${sent.length}`);
const bella = sent.find((m) => m.to.includes("bella@example.com"));
if (!bella.subject.includes("Bella") || !bella.html.includes("Hi Bella")) fail("Bella's email not personalized");
if (!bella.html.includes("PO Box 123") || !/\/u\/[0-9a-f]{24}/.test(bella.html)) fail("footer address or unsubscribe link missing");
if (!/\/api\/unsubscribe\/[0-9a-f]{24}/.test(bella.unsubscribe ?? "") || bella.unsubscribePost !== "List-Unsubscribe=One-Click") fail("one-click unsubscribe headers missing");
if (sent.some((m) => m.to.includes("eve@example.com"))) fail("unsubscribed client got it");
step("4 personalized emails with address, unsubscribe link and one-click headers; Eve left out");

const token = bella.html.match(/\/u\/([0-9a-f]{24})/)[1];
await page.goto(`${BASE}/u/${token}`);
await page.getByRole("button", { name: "Unsubscribe" }).click();
await page.getByRole("heading", { name: "You're unsubscribed" }).waitFor();
step("unsubscribe page works");
const carlToken = sent.find((m) => m.to.includes("carl@example.com")).unsubscribe.match(/unsubscribe\/([0-9a-f]{24})/)[1];
const oneClick = await page.request.post(`${BASE}/api/unsubscribe/${carlToken}`, { form: { "List-Unsubscribe": "One-Click" } });
if (!oneClick.ok()) fail("one-click unsubscribe failed");
step("one-click unsubscribe works");

await page.goto(`${BASE}/marketing`);
await page.getByRole("link", { name: /We miss you|It's been a while/ }).first().waitFor();
await page.goto(`${BASE}/marketing/new`);
await page.getByRole("button", { name: /We miss you/ }).first().waitFor();
if (!(await page.getByText(/Last sent/).count())) fail("'We miss you' should show when it was last sent");
await page.getByRole("button", { name: /Start from scratch/ }).click();
await page.waitForURL(/\/marketing\/[0-9a-f-]+$/);
await page.goto(`${page.url()}?step=recipients`);
if ((await count()) !== 2) fail("Bella and Carl unsubscribed: 2 left");
step("unsubscribed clients drop out of the next campaign");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
