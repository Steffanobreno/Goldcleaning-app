// End-to-end check of the core loop on a fresh database, at iPhone width:
// set up the owner, add a client and their home, book a cleaning, edit its price, run the
// day, check out with Venmo + tip.
// Usage: node tests/e2e/slice.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "test-results/screens";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("response", (r) => r.status() === 404 && errors.push(`404 ${r.url()}`));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: "initial" });
const step = (msg) => console.log(`✓ ${msg}`);

// Next Tuesday at 09:00 (the Morning slot), inside working hours.
const d = new Date();
do d.setDate(d.getDate() + 1);
while (d.getDay() !== 2);
const date = d.toISOString().slice(0, 10);

await page.goto(`${BASE}/login`);
await page.waitForURL(/\/setup/);
// A production build asks for the server's SETUP_CODE (start it with SETUP_CODE=e2e-code).
if (await page.locator('input[name="setup_code"]').count()) await page.fill('input[name="setup_code"]', process.env.SETUP_CODE ?? "e2e-code");
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.fill('input[name="confirm"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await shot("today-empty");
step("owner account created, landed on Today");

await page.goto(`${BASE}/clients/new`);
await page.fill('input[name="first_name"]', "Ana");
await page.fill('input[name="last_name"]', "Silva");
await page.fill('input[name="phone"]', "(650) 555-0142");
await page.fill('input[name="email"]', "ana@example.com");
await page.fill('input[name="address_line"]', "100 Ellsworth Ave");
await page.fill('input[name="city"]', "San Mateo");
await page.fill('input[name="zip"]', "94401");
await page.click('button[type="submit"]');
await page.waitForURL(/\/homes\/new/);
step("client saved");

// The first home starts from the client's address.
if ((await page.inputValue('input[name="zip"]')) !== "94401") throw new Error("home did not start from the client's address");
await page.selectOption('select[name="bedrooms"]', "3");
await page.selectOption('select[name="full_baths"]', "2");
await page.selectOption('select[name="half_baths"]', "1");
await page.selectOption('select[name="access_method"]', "lockbox");
await page.fill('input[name="access_code"]', "4321");
await page.fill('input[name="pets_in_home"]', "1 cat");
await page.click('button[name="then"][value="book"]');
await page.waitForURL(/\/appointments\/new\?client=.*&home=/);
step("home 3 bd / 2 ba / 1 half saved, went straight to booking");

await page.goto(page.url() + `&date=${date}&time=09:00`);
await page.selectOption('select[name="service"]', { label: "Regular Clean" });
await page.getByText("Weekly", { exact: true }).click();
await page.locator("summary", { hasText: "Extras" }).click();
await page.getByRole("button", { name: "More Inside Oven" }).click();
await page.getByTestId("total").getByText("$278.40").waitFor();
await shot("new-appointment");
await page.getByRole("button", { name: "Book cleaning" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.getByTestId("appt-total").getByText("$278.40").waitFor();
await page.getByText("9:00 AM – 12:00 PM · 3h").waitFor();
await page.getByText("Lockbox · 4321").waitFor();
await shot("appointment");
step("booked Regular weekly + Inside Oven = $278.40, 9:00–12:00");

// Re-pricing: a $10 discount, then back. The lines are worked out again from the price list.
const apptUrl = page.url().split("?")[0];
await page.getByRole("link", { name: "Edit price" }).first().click();
await page.getByRole("heading", { name: "Edit price" }).waitFor();
await page.fill('input[name="adjustment"]', "-10");
await page.getByTestId("total").getByText("$268.40").waitFor();
await page.getByRole("button", { name: "Save" }).click();
await page.waitForURL(apptUrl);
await page.getByTestId("appt-total").getByText("$268.40").waitFor();
await page.getByRole("link", { name: "Edit price" }).first().click();
await page.fill('input[name="adjustment"]', "");
await page.getByRole("button", { name: "Save" }).click();
await page.waitForURL(apptUrl);
await page.getByTestId("appt-total").getByText("$278.40").waitFor();
step("edited the price with a discount and back");

// A second booking at the same time warns (the owner may book it anyway).
const clientId = (await page.getByRole("link", { name: "Client profile" }).getAttribute("href")).split("/")[2];
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=10:00`);
await page.getByRole("button", { name: "Book cleaning" }).click();
await page.getByText("This overlaps Ana's visit at 9:00 AM.").waitFor();
await page.getByLabel("Book anyway").waitFor();
step("overlapping booking warns");

await page.goto(`${BASE}/today?date=${date}`);
await page.getByText("Ana Silva").waitFor();
await page.getByText("Regular Clean · 3 bd / 2 ba / 1 half").first().waitFor();
await shot("today");
step("Today shows the cleaning");

await page.goto(apptUrl);
for (const label of ["Mark as confirmed", "I'm on the way", "Check in", "Finish and check out"]) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForLoadState("networkidle");
}
await page.waitForURL(/\/checkout/);
await page.getByText("Regular Clean · Weekly").waitFor();
await page.getByText("Inside Oven").waitFor();
step("status moved confirmed → on the way → in progress → done; the bill has the lines");

await page.getByRole("button", { name: "Custom tip amount" }).click();
await page.getByLabel("Tip amount").fill("20");
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByRole("button", { name: "Venmo" }).click();
await page.fill('input[name="reference"]', "@ana-silva");
await shot("checkout");
await page.getByRole("button", { name: "Charge $298.40" }).click();
await page.getByText("Paid in full").waitFor();
await page.getByText("incl. $20.00 tip").waitFor();
await shot("checkout-paid");
step("paid $278.40 by Venmo with a $20 tip; invoice closed");

// A second home the same afternoon, in San Carlos: Today shows the distance from Ana's, and
// the Year view shows the day as full (two cleanings).
await page.goto(`${BASE}/clients/new`);
await page.fill('input[name="first_name"]', "Ben");
await page.fill('input[name="last_name"]', "Costa");
await page.fill('input[name="phone"]', "(650) 555-0143");
await page.fill('input[name="address_line"]', "12 Laurel St");
await page.fill('input[name="city"]', "San Carlos");
await page.fill('input[name="zip"]', "94070");
await page.click('button[type="submit"]');
await page.waitForURL(/\/homes\/new/);
await page.click('button[name="then"][value="book"]');
await page.waitForURL(/\/appointments\/new\?client=/);
await page.goto(page.url() + `&date=${date}&time=13:00`);
await page.getByRole("button", { name: "Book cleaning" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.goto(`${BASE}/today?date=${date}`);
await page.getByText(/↓ \d+\.\d mi from Ana's/).waitFor();
await shot("today-two-homes");
const dayName = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
await page.goto(`${BASE}/calendar?view=year&date=${date}`);
await page.getByRole("link", { name: `${dayName}: full` }).waitFor();
await shot("calendar-year");
step("Today shows the miles between the two homes; the Year view shows the day full");

for (const view of ["day", "week", "month", "agenda"]) {
  await page.goto(`${BASE}/calendar?view=${view}&date=${date}`);
  await page.getByRole("link", { name: /Ana/ }).first().waitFor();
  await shot(`calendar-${view}`);
}
step("calendar day, week, month and agenda views show the cleaning");

await page.goto(`${BASE}/clients/${clientId}`);
await page.getByText("Home · 3 bd / 2 ba / 1 half").waitFor();
await page.getByText("🐾 1 cat").waitFor();
await shot("client");
await page.goto(`${BASE}/reports?period=today`);
await page.getByText("$298.40").first().waitFor();
await page.getByText("incl. $20.00 tips").waitFor();
await shot("reports");
step("client profile and reports render");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
