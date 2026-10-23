// Bookings that keep the route short, end to end. Run after slice.mjs, with NEAR_DATE set to a
// working day that has one visit in San Mateo (94401) at 9:00–11:00 and nothing else, e.g.:
//   psql: insert a visit for an existing client with zip 94401 on that day (see the shell that runs it).
// A new client in 94402 (≈2 miles away) sees "We're already in your area" with that day picked
// first and ⭐ on the time right after the visit; the owner's booking form for a client in
// 94402 lists that day with "after 11:00 AM".
// Usage: NEAR_DATE=yyyy-mm-dd CLIENT_ID=<client in 94402> node tests/e2e/nearby.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const { NEAR_DATE, CLIENT_ID } = process.env;
if (!NEAR_DATE || !CLIENT_ID) throw new Error("Set NEAR_DATE and CLIENT_ID");
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
const label = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

await page.goto(`${BASE}/book`);
await page.getByLabel("Mobile phone").fill("6505550188");
await button("Next").click();
await page.getByText("It looks like your first visit with us.").waitFor();
await page.getByLabel("First name").fill("Nina");
await page.getByLabel("Last name").fill("Near");
await page.getByLabel("Email").fill("nina@example.com");
await button("Continue").click();
await page.getByLabel("Street address").fill("10 Elm St");
await page.getByLabel("City").fill("San Mateo");
await page.getByLabel("ZIP code").fill("94402");
await button("Continue").click();
await page.getByLabel("Breed").fill("malt");
await button("Maltese").click();
await page.getByLabel("Pet's name").fill("Pip");
await page.getByRole("radio", { name: /^Small/ }).click();
await button("Save Pip").click();
await button("Continue to service").click();
await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Bath", exact: true }).click();
await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await button("Continue").click();
await page.getByRole("radio", { name: "No", exact: true }).click();
await button("Confirm info for Pip").click();
await page.getByRole("heading", { name: "Select a time" }).waitFor();

await page.getByText("We're already in your area on").waitFor();
const chip = page.getByRole("button", { name: label(NEAR_DATE), exact: true });
if ((await chip.getAttribute("aria-pressed")) !== "true") fail("the nearby day should be picked first");
const times = page.getByRole("group", { name: "Open times" });
await times.getByText("Best times").waitFor();
const starred = await times.locator("button", { hasText: "⭐" }).allInnerTexts();
if (!starred.some((t) => /11:00 am|11:15 am|11:30 am/.test(t))) fail(`⭐ should be right after the 9–11 visit, got ${starred.join(", ")}`);
await page.screenshot({ path: "/tmp/nearby-book.png", fullPage: true }).catch(() => {});
step(`client in 94402: "in your area" with ${label(NEAR_DATE)} picked first, ⭐ ${starred.join(" ")}`);

// The owner side.
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/appointments/new?client=${CLIENT_ID}`);
await page.getByText(/You're already near/).waitFor();
const link = page.getByRole("link", { name: new RegExp(label(NEAR_DATE)) });
await link.click();
await page.waitForURL(new RegExp(`date=${NEAR_DATE}&time=11:00`));
if ((await page.locator('input[name="time"]').inputValue()) !== "11:00") fail("time should be set right after the nearby visit");
step("owner booking: nearby day listed, tap fills the date and 11:00");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
