// Vaccines, end to end. Run after slice.mjs (Maria Lopez, pet Biscuit, a visit today).
// Add an expired Rabies and a Bordetella that expires in 10 days → badges on the pet,
// warnings on the client, the booking form, the visit and Today; delete one.
// Usage: VISIT_DATE=yyyy-mm-dd node tests/e2e/vaccines.mjs [baseUrl]
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
const day = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

await page.goto(`${BASE}/clients?q=Maria`);
await page.getByRole("link", { name: /Maria/ }).first().click();
await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
const clientUrl = page.url();
await page.locator(`a[href*="/pets/"]`).filter({ hasNotText: "Add pet" }).first().click();
await page.waitForURL(/\/pets\/[0-9a-f-]+$/);
const petUrl = page.url();

const add = async (name, expires) => {
  await page.fill('input[list="vaccine-names"]', name);
  await page.fill('input[name="expires_on"]', expires);
  await page.getByRole("button", { name: "Add vaccine" }).click();
  await page.locator("li", { hasText: name }).waitFor();
};
await add("Rabies", day(-2));
await add("Bordetella", day(10));
await page.locator("li", { hasText: "Rabies" }).getByText("Expired").waitFor();
await page.locator("li", { hasText: "Bordetella" }).getByText("Expires soon").waitFor();
step("pet page: Rabies expired, Bordetella expires soon");

await page.goto(clientUrl);
await page.getByText(/💉 Rabies expired/).waitFor();
await page.getByText(/💉 Bordetella expires/).waitFor();
step("client profile shows both warnings");

await page.goto(`${BASE}/appointments/new?client=${clientUrl.split("/").pop()}`);
await page.getByText(/💉 Rabies expired/).waitFor();
step("booking form warns on the pet");

// VISIT_DATE: the day of the slice visit (the machine's "today" may differ).
await page.goto(`${BASE}/today${process.env.VISIT_DATE ? `?date=${process.env.VISIT_DATE}` : ""}`);
await page.getByText(/💉 .*Rabies expired/).waitFor();
await page.locator('a[href^="/appointments/"]:not([href*="new"])').first().click();
await page.getByText(/Rabies expired .* ask for the new certificate/).waitFor();
step("Today stop and the visit show the warning");

// A renewed Rabies clears the alert.
await page.goto(petUrl);
await add("Rabies", day(365));
await page.goto(clientUrl);
if (await page.getByText(/💉 Rabies/).count()) fail("renewed Rabies should clear the warning");
step("adding the renewed Rabies clears the warning");

await page.goto(petUrl);
await page.getByRole("button", { name: "Delete Bordetella" }).click();
await page.locator("li", { hasText: "Bordetella" }).waitFor({ state: "detached" });
step("delete a vaccine");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
