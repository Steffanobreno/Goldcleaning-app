// Everyday fixes, end to end. Run after slice.mjs (Maria Lopez paid by Venmo, pet Biscuit).
// Inactive clients tab · pet passed away and back · delete a note · remove a payment reopens
// the bill · bad ids show "not found" · wrong passwords lock the login for a while.
// Usage: node tests/e2e/fixes.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
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
const login = async (password) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', "owner@example.com");
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
};

await login("correct horse battery");
await page.waitForURL(/\/today/);

await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientUrl = page.url();

// Notes
await page.fill("#note", "Gate code 1234");
await page.getByRole("button", { name: "Add note" }).click();
await page.getByText("Gate code 1234").waitFor();
await page.locator("form", { has: page.getByRole("button", { name: "Delete" }) }).first().getByRole("button", { name: "Delete" }).click();
await page.getByText("Gate code 1234").waitFor({ state: "detached" });
step("add and delete a client note");

// Inactive
await page.getByRole("switch", { name: /Inactive customer/ }).click();
await page.goto(`${BASE}/clients?q=Maria`);
if (await page.getByRole("link", { name: /Maria Lopez/ }).count()) fail("inactive client still in the active list");
await page.getByRole("link", { name: "Inactive clients" }).click();
await page.getByRole("link", { name: /Maria Lopez/ }).click();
await page.getByRole("switch", { name: /Inactive customer/ }).click();
step("inactive clients have their own list and can be made active again");

// Pet passed away
await page.goto(clientUrl);
const petLink = page.locator(`a[href*="/pets/"]`).filter({ hasNotText: "Add pet" }).first();
await petLink.click();
await page.waitForURL(/\/pets\/[0-9a-f-]+$/);
const petUrl = page.url();
await page.getByRole("button", { name: /passed away/ }).click();
await page.waitForURL(clientUrl);
await page.getByText("In memory").waitFor();
await page.goto(petUrl);
await page.getByRole("button", { name: /still with us/ }).click();
await page.waitForURL(clientUrl);
if (await page.getByText("In memory").count()) fail("pet should be back");
step("pet passed away shows 'In memory' and can be undone");

// Remove a payment
const visit = await page.locator('a[href^="/appointments/"]:not([href*="new"])').first().getAttribute("href");
await page.goto(`${BASE}${visit}/checkout`);
await page.getByText("Remove").first().click();
await page.getByRole("button", { name: "Yes, remove it" }).click();
await page.getByRole("button", { name: /^Charge|Add a tip/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
if (!(await page.getByText(/Add a tip/).count())) fail("bill should be open again after removing the payment");
step("removing a payment opens the bill again");

// Bad ids
for (const path of ["/clients/abc", "/appointments/abc", "/calendar/block/abc", "/marketing/abc"]) {
  // With a loading screen the status is already sent, so check the page says "not found".
  await page.goto(`${BASE}${path}`);
  await page.getByText(/could not be found|not found/i).first().waitFor({ timeout: 10_000 });
  if (await page.getByText(/That took too long|Try again/).count()) fail(`${path} shows the error page`);
}
step("bad ids show \"not found\", not the error page");

// Login lock
await page.context().clearCookies();
for (let i = 0; i < 8; i++) {
  await login("wrong password");
  await page.getByText(/don't match|Too many/).waitFor();
}
await login("correct horse battery");
await page.getByText("Too many wrong tries").waitFor();
step("8 wrong passwords lock the login for 15 minutes");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
