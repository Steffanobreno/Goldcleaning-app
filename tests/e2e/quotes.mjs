// Quote requests (Airbnb and Office), end to end. Run after slice.mjs (it reuses that owner).
// A host picks Airbnb Turnover on /book → no price anywhere, a short form with a photo → thank you.
// The owner sees it under Requests → Quotes with the photo, makes the client and books it at an
// agreed price. An office request gets archived.
// Usage: DATABASE_URL=... node tests/e2e/quotes.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "test-results/screens";
mkdirSync(SHOTS, { recursive: true });
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

// A photo to attach: a screenshot of a blank page is a real PNG.
const photo = `${SHOTS}/quote-photo.png`;
await page.setContent("<body style='background:linear-gradient(#c6a45e,#0b1f3b);height:600px'></body>");
await page.screenshot({ path: photo });

async function sendQuote(service, first, phone, fill) {
  await page.goto(`${BASE}/book`);
  await page.getByRole("radio", { name: new RegExp(`^${service}`) }).click();
  await page.getByRole("region", { name: "Quote request" }).waitFor();
  if (await page.getByText(/\$\d/).count()) fail(`a price shows for ${service}`);
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last name").fill("Host");
  await page.getByLabel("Email").fill(`${first.toLowerCase()}@example.com`);
  await page.getByLabel("Phone").fill(phone);
  await page.getByLabel("City").fill("Palo Alto");
  await page.getByLabel("ZIP").fill("94301");
  await fill();
  await page.getByLabel("Tell us what you need").fill("Turnover between guests, linens included. Check-out 11am, check-in 4pm.");
  await page.getByRole("button", { name: "Request a quote" }).click();
  await page.getByText(`Thank you, ${first}!`).waitFor();
}

await sendQuote("Airbnb Turnover", "Hana", "6505550301", async () => {
  await page.getByLabel("Bedrooms").fill("2");
  await page.getByLabel("Bathrooms").fill("1");
  await page.getByLabel("How often").selectOption("Between every guest");
  await page.setInputFiles('input[type="file"]', photo);
  await page.getByAltText("Photo 1").waitFor();
  await page.screenshot({ path: `${SHOTS}/quote-form.png`, fullPage: true });
});
step("Airbnb Turnover shows no price, only the quote form; sent with a photo");
await sendQuote("Office Cleaning", "Omar", "6505550302", async () => {
  await page.getByLabel("Square feet (about)").fill("2400");
});
step("Office Cleaning asks for square feet; sent");

const [q] = await sql`
  select q.kind, q.bedrooms, q.frequency, (select count(*)::int from quote_request_photos p where p.quote_request_id = q.id) as photos
  from quote_requests q where q.phone = '+16505550301'`;
if (q?.kind !== "airbnb" || q.bedrooms !== 2 || q.photos !== 1) fail(`stored quote wrong: ${JSON.stringify(q)}`);
const [m] = await sql`select subject from messages where template_trigger = 'quote_received' and to_email = 'hana@example.com'`;
if (!m) fail("no 'we got your request' email queued for the client");
step("stored with its photo; the client's confirmation email is queued");

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.getByRole("link", { name: "2 quote requests waiting" }).click();
await page.waitForURL(/tab=quotes/);
await page.getByText("Hana Host").waitFor();
await page.getByText("Airbnb / short-term rental · 2 bd / 1 ba · Between every guest").waitFor();
const img = page.getByAltText("Photo 1 from Hana");
await img.waitFor();
const res = await page.request.get(new URL(await img.getAttribute("src"), BASE).href);
if (res.status() !== 200 || res.headers()["content-type"] !== "image/jpeg") fail(`photo: ${res.status()} ${res.headers()["content-type"]}`);
await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await img.elementHandle());
await page.getByText("Office · 2,400 sq ft").waitFor();
await page.screenshot({ path: `${SHOTS}/quotes.png`, fullPage: true });
step("owner sees both under Requests → Quotes, with Hana's photo");

// The office one: archived.
const omar = page.getByRole("article").filter({ hasText: "Omar Host" });
await omar.getByRole("button", { name: "Archive" }).last().click();
await page.getByText("Omar Host").waitFor({ state: "detached" });
await page.goto(`${BASE}/requests?tab=quotes&closed=1`);
await page.getByText("Omar Host").waitFor();
step("Archive moves the office request out of the open list");

// Hana: make her a client and book at the agreed price.
await page.goto(`${BASE}/requests?tab=quotes`);
await page.getByRole("article").filter({ hasText: "Hana Host" }).getByRole("button", { name: "Make client and book" }).click();
await page.waitForURL(/\/appointments\/new\?client=.*&home=/);
await page.getByText("Rental · 2 bd / 1 ba").waitFor();
const fri = new Date();
do fri.setDate(fri.getDate() + 1);
while (fri.getDay() !== 5);
await page.goto(page.url() + `&date=${fri.toISOString().slice(0, 10)}&time=13:00`);
await page.selectOption('select[name="service"]', { label: "Airbnb Turnover (agreed price)" });
await page.getByText("Every 2 weeks", { exact: true }).click();
await page.fill('input[name="agreed_price"]', "165");
await page.getByTestId("total").getByText("$165.00").waitFor();
await page.getByRole("button", { name: "Book cleaning" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.getByText("Airbnb Turnover · Every 2 weeks").waitFor();
await page.getByTestId("appt-total").getByText("$165.00").waitFor();
step("Make client and book: Hana is a client and booked every 2 weeks at the agreed $165");

await browser.close();
await sql.end();
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
console.log("All good.");
