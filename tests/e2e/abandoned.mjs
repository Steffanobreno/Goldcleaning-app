// Abandoned online bookings, end to end. Run after slice.mjs (it reuses that owner).
// Someone picks a cleaning on /book, fills in the contact step and leaves → the draft keeps
// the service, home size and total → the owner sees it, adds them as a client (with that home)
// and books them → it shows as Recovered. Delete hides one from the list.
// Usage: DATABASE_URL=... node tests/e2e/abandoned.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

async function startAndLeave(first, phone) {
  await page.goto(`${BASE}/book`);
  await page.getByRole("radio", { name: "Deep Clean" }).click();
  await page.getByLabel("Bedrooms").selectOption("4");
  await page.getByLabel("Full baths").selectOption("3");
  await page.getByRole("button", { name: /^Baseboards/ }).click();
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last name").fill("Left");
  await page.getByLabel("Email").fill(`${first.toLowerCase()}@example.com`);
  await page.getByLabel("Mobile phone").fill(phone);
  await page.getByRole("button", { name: "See available times" }).click();
  await page.locator("button[aria-label*='open time']").first().waitFor();
  await page.waitForTimeout(1000); // the draft call is fire-and-forget
}
await startAndLeave("Lily", "6505550166");
await startAndLeave("Max", "6505550167");
// They left more than 20 minutes ago.
await sql`update booking_drafts set updated_at = now() - interval '30 minutes', created_at = now() - interval '30 minutes'
          where phone in ('+16505550166', '+16505550167')`;
const [d] = await sql`select summary, details from booking_drafts where phone = '+16505550166'`;
if (d?.details?.totalCents !== 33100 + 3 * 2500 + 2 * 4200 + 5000) fail(`draft details wrong: ${JSON.stringify(d)}`);
step("started a Deep Clean 4/3 + baseboards ($540), left after the contact step");

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/requests`);
await page.getByText(/didn't finish booking online/).click();
await page.waitForURL(/\/abandoned/);
const card = page.getByRole("link", { name: /Lily Left/ });
await card.getByText(/Abandoned step: Name and email · Deep Clean · One-time · 4 bd \/ 3 ba/).waitFor();
step("Abandoned list: Lily stopped after name and email, with what she picked");

await card.click();
await page.waitForURL(/\/abandoned\/[0-9a-f-]+$/);
await page.getByText("lily@example.com").waitFor();
await page.getByText("4 bd / 3 ba").waitFor();
await page.getByText("Baseboards").waitFor();
await page.getByText("$540.00").waitFor();
await page.getByRole("button", { name: "Call" }).waitFor();
step("detail page shows her email, home size, extras and the total she saw");

await page.getByRole("button", { name: "Add client" }).click();
await page.waitForURL(/\/appointments\/new\?client=/);
await page.getByText("Home · 4 bd / 3 ba").waitFor();
step("Add client makes Lily a client with her home and opens the booking form");
const tue = new Date();
do tue.setDate(tue.getDate() + 1);
while (tue.getDay() !== 3);
await page.goto(page.url() + `&date=${tue.toISOString().slice(0, 10)}&time=13:00`);
await page.selectOption('select[name="service"]', { label: "Deep Clean" });
await page.getByRole("button", { name: "Book cleaning" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.goto(`${BASE}/abandoned?status=recovered`);
await page.getByRole("link", { name: /Lily Left/ }).getByText("Recovered").waitFor();
step("after booking her, Lily shows as Recovered");

await page.goto(`${BASE}/abandoned`);
await page.getByRole("link", { name: /Max Left/ }).click();
await page.getByRole("button", { name: "Delete" }).click();
await page.waitForURL(/\/abandoned$/);
if (await page.getByRole("link", { name: /Max Left/ }).count()) fail("Max is still listed");
step("Delete removes an abandoned booking from the list");

await browser.close();
await sql.end();
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
console.log("All good.");
