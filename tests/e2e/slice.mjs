// End-to-end check of the core loop on a fresh database, at iPhone width:
// set up the owner, add a client and pet, book, run the day, check out with Venmo + tip.
// Usage: node tests/e2e/slice.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: "initial" });
const step = (msg) => console.log(`✓ ${msg}`);

// Next weekday at 10:00, so the booking is inside working hours.
const d = new Date();
do d.setDate(d.getDate() + 1);
while (d.getDay() === 0);
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
await shot("S02-today-empty");
step("owner account created, landed on Today");

await page.goto(`${BASE}/clients/new`);
await page.fill('input[name="first_name"]', "Maria");
await page.fill('input[name="last_name"]', "Lopez");
await page.fill('input[name="phone"]', "(650) 555-0142");
await page.fill('input[name="address_line"]', "450 Serra Mall");
await page.fill('input[name="city"]', "Stanford");
await page.fill('input[name="zip"]', "94305");
await page.fill('textarea[name="access_notes"]', "Park in the driveway, outlet by the garage.");
await page.click('button[type="submit"]');
await page.waitForURL(/\/pets\/new/);
step("client saved");

await page.fill('input[name="name"]', "Biscuit");
await page.fill('input[name="breed"]', "Goldendoodle");
await page.selectOption('select[name="size_class"]', "medium");
await page.fill('input[name="rebook_every_days"]', "42");
await page.fill('textarea[name="behavior"]', "Nervous with the dryer");
await page.click('button[name="then"][value="book"]');
await page.waitForURL(/\/appointments\/new\?client=/);
step("pet saved, went straight to booking");

await page.goto(page.url().replace(/&?date=[^&]*/, "") + `&date=${date}&time=10:00`);
const select = page.locator('select[name^="svc:"]');
const option = await select.locator("option", { hasText: "Full Haircut - Medium" }).getAttribute("value");
await select.selectOption(option);
await page.locator("summary", { hasText: "Add-ons" }).click();
await page.getByLabel("De-shedding").check();
await shot("S05-new-appointment");
await page.getByRole("button", { name: "Book appointment" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
await page.getByText("$194.00").first().waitFor();
await shot("S06-appointment");
step("booked Full Haircut Medium + De-shedding = $194");

// The groomer can change a service's time and price after booking; the visit's end moves.
const bookedUrl = page.url().split("?")[0];
await page.getByRole("link", { name: "Edit services" }).first().click();
await page.getByRole("heading", { name: "Edit services" }).waitFor();
for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^More time for Full Haircut/ }).click();
await page.getByText("10:00 AM – 1:00 PM").waitFor();
await shot("S07-edit-services");
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(bookedUrl);
await page.getByText("10:00 AM – 1:00 PM · 3h").waitFor();
await page.getByRole("link", { name: "Edit services" }).first().click();
for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^Less time for Full Haircut/ }).click();
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(bookedUrl);
await page.getByText("10:00 AM – 12:00 PM · 2h").waitFor();
step("edited the haircut to 3h and back: the visit end moves with it");

// Double booking must be refused by the database.
const apptUrl = page.url().split("?")[0];
const clientId = (await page.getByRole("link", { name: "Client profile" }).getAttribute("href")).split("/")[2];
await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=10:30`);
const sel2 = page.locator('select[name^="svc:"]');
await sel2.selectOption(await sel2.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
await page.getByRole("button", { name: "Book appointment" }).click();
await page.getByText("This overlaps Maria's visit at 10:00 AM.").waitFor();
await page.getByLabel("Book anyway").waitFor();
step("overlapping booking warns (the owner may book it anyway)");

await page.goto(`${BASE}/today?date=${date}`);
await page.getByText("Maria Lopez").waitFor();
await page.getByRole("link", { name: "Open the whole route in Google Maps" }).waitFor();
await shot("S02-today-route");
step("Today shows the stop and the Google Maps route link");

await page.goto(apptUrl);
for (const label of ["Mark as confirmed", "I'm on the way", "Check in", "Finish and check out"]) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForLoadState("networkidle");
}
await page.waitForURL(/\/checkout/);
step("status moved confirmed → on the way → grooming → done");

// A one-time 10% discount and a $5 service charge, then removed, so the bill stays $194.
await page.getByText("+ Add a discount").click();
await page.getByLabel("+ Add a discount amount").fill("10");
await page.locator("details[open] select[name=unit]").selectOption("percent");
await page.locator("details[open]").getByRole("button", { name: "Add" }).click();
await page.getByText("Discount (10%)").waitFor();
await page.getByText("−$19.40").waitFor();
await page.getByRole("button", { name: "Remove Discount (10%)" }).click();
await page.getByText("Discount (10%)").waitFor({ state: "detached" });
await page.locator("summary", { hasText: "Checked in" }).waitFor();
// Tip 20% → Venmo → charge.
await page.getByRole("button", { name: "$38.80 (20%)" }).click();
await page.getByRole("button", { name: "Venmo" }).click();
await page.fill('input[name="reference"]', "@maria-lopez");
await shot("S13-checkout");
await page.getByRole("button", { name: "Charge $232.80" }).click();
await page.getByText("Paid in full").waitFor();
await page.getByText("incl. $38.80 tip").waitFor();
await shot("S13-checkout-paid");
step("paid by Venmo with a 20% tip ($38.80)");

for (const view of ["day", "week", "month", "agenda"]) {
  await page.goto(`${BASE}/calendar?view=${view}&date=${date}`);
  await page.getByRole("link", { name: /Maria/ }).first().waitFor();
  await shot(`S04-calendar-${view}`);
}
step("calendar day, week, month and agenda views show the visit");

// Reports: the Venmo payment ($194 + $38.80 tip) was received today.
await page.goto(`${BASE}/reports?period=today`);
await page.getByText("$232.80").first().waitFor();
await page.getByText("incl. $38.80 tips").waitFor();
await shot("S40-reports");
await page.goto(`${BASE}/reports?from=${date}&to=${date}`);
await page.getByText("Dogs groomed").waitFor();
step("reports show today's collected money and tips");
await page.goto(`${BASE}/settings/services`);
await shot("S18-services");
await page.goto(`${BASE}/settings/hours`);
await shot("S17-hours");
step("calendar, services and hours render");

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
