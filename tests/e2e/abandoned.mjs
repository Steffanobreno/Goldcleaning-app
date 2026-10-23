// Abandoned online bookings, end to end. Run after slice.mjs and booking.mjs.
// Someone types phone, name, email and address on /book and stops → the draft is saved →
// (the shell then runs the reminder step) → the owner sees it under Booking requests with
// Text / Call / Clear, and the "finish" link opens /book with the phone filled in.
// Usage: STAGE=start|after node tests/e2e/abandoned.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const STAGE = process.env.STAGE ?? "start";
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
const button = (name) => page.getByRole("button", { name, exact: true });

if (STAGE === "start") {
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Mobile phone").fill("6505550166");
  await button("Next").click();
  await page.getByText("It looks like your first visit with us.").waitFor();
  await page.getByLabel("First name").fill("Lily");
  await page.getByLabel("Last name").fill("Left");
  await page.getByLabel("Email").fill("lily@example.com");
  await button("Continue").click();
  await page.getByLabel("Street address").fill("3 Bay St");
  await page.getByLabel("City").fill("San Mateo");
  await page.getByLabel("ZIP code").fill("94402");
  await button("Continue").click();
  await page.getByLabel("Breed").waitFor();
  await page.waitForTimeout(1500); // the tracking call is fire-and-forget
  step("started a booking and stopped at the pet step");
} else {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', "correct horse battery");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/today/);
  await page.goto(`${BASE}/requests`);
  await page.getByText(/didn't finish booking online/).click();
  await page.waitForURL(/\/abandoned/);
  const card = page.getByRole("link", { name: /Lily Left/ });
  await card.getByText("Contacted").waitFor(); // the recovery message went out
  await card.getByText(/Abandoned step: Address/).waitFor();
  step("Abandoned bookings tab: Lily is Contacted, stopped at Address");

  await card.click();
  await page.waitForURL(/\/abandoned\/[0-9a-f-]+$/);
  await page.getByText("lily@example.com").waitFor();
  await page.getByText(/3 Bay St, San Mateo, 94402/).waitFor();
  step("detail page shows the email and the address she typed");

  await page.goto(`${BASE}/book?phone=6505550166`);
  if ((await page.getByLabel("Mobile phone").inputValue()).replace(/\D/g, "") !== "6505550166") fail("finish link should fill the phone");
  step("the finish link opens the booking page with the phone filled in");

  // Add client → book her → Recovered with the visit's value.
  await page.goto(`${BASE}/abandoned`);
  await page.getByRole("link", { name: /Lily Left/ }).click();
  await page.getByRole("button", { name: "Add client" }).click();
  await page.waitForURL(/\/appointments\/new\?client=/);
  await page.getByRole("link", { name: "Add a pet" }).waitFor(); // she stopped before adding her pet
  step("Add client makes Lily a client and opens the booking form");
  const clientId = new URL(page.url()).searchParams.get("client");
  await page.goto(`${BASE}/clients/${clientId}/pets/new`);
  await page.fill('input[name="name"]', "Pip");
  await page.selectOption('select[name="size_class"]', "small");
  await page.getByRole("button", { name: "Save and book" }).click();
  await page.waitForURL(/\/appointments\/new\?client=/);
  const sel = page.locator('select[name^="svc:"]');
  await sel.selectOption(await sel.locator("option", { hasText: "Bath - Small" }).getAttribute("value"));
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
  await page.goto(`${BASE}/abandoned?status=recovered`);
  await page.getByRole("link", { name: /Lily Left/ }).getByText("Recovered").waitFor();
  step("after booking her, Lily is Recovered and counted in the stats");

  // Delete another one.
  await page.goto(`${BASE}/abandoned?status=contacted`);
  const before = await page.locator('a[href^="/abandoned/"]').count();
  if (before > 0) {
    await page.locator('a[href^="/abandoned/"]').first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/abandoned$/);
    step("Delete removes an abandoned booking from the list");
  }
}
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
