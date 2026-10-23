// Removing a client for good. Run after slice.mjs and booking.mjs: Maria Lopez has a paid
// visit; Ana Silva has visits, a signed agreement, a pet photo and messages.
// Usage: node tests/e2e/remove-client.mjs [baseUrl]
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

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

for (const name of ["Maria Lopez", "Ana Silva"]) {
  await page.goto(`${BASE}/clients?q=${encodeURIComponent(name.split(" ")[0])}`);
  await page.getByRole("link", { name: new RegExp(name) }).first().click();
  await page.waitForURL(/\/clients\/[0-9a-f-]+$/);
  await page.getByText("Remove client").click();
  await page.getByText(/can't be undone/).waitFor();
  await page.getByRole("button", { name: /forever/ }).click();
  await page.waitForURL(/\/clients\?removed=1/);
  await page.getByText("Client removed.").waitFor();
  await page.goto(`${BASE}/clients?q=${encodeURIComponent(name)}`);
  if (await page.getByRole("link", { name: new RegExp(name) }).count()) fail(`${name} still listed`);
  step(`${name} removed with visits, payments and everything else`);
}
await page.goto(`${BASE}/reports`);
await page.goto(`${BASE}/calendar?view=agenda`);
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
