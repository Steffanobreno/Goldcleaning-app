// Groomers and backups, end to end. Run after slice.mjs (it reuses Maria Lopez, the client).
// Add a groomer → book the same time for the owner and for her (no clash: separate routes) →
// calendar and Today filter by groomer → give a visit to another groomer → backup files.
// Usage: BACKUP_KEY=... node tests/e2e/team-backup.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
const KEY = process.env.BACKUP_KEY;
if (!KEY) throw new Error("Set BACKUP_KEY");
mkdirSync(SHOTS, { recursive: true });

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

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

// Team
await page.goto(`${BASE}/settings/team`);
await page.fill('input[name="name"]', "Jess");
await page.fill('input[name="phone"]', "6505550199");
await page.getByRole("button", { name: "Color #1f9d55" }).click();
await page.getByRole("button", { name: "Add groomer" }).click();
await page.getByRole("link", { name: /Jess/ }).waitFor();
await shot("team");
step("added groomer Jess");

// Same time, two groomers.
await page.goto(`${BASE}/clients?q=Maria`);
const clientId = (await page.getByRole("link", { name: /Maria/ }).first().getAttribute("href")).split("/")[2];
const d = new Date(Date.now() + 40 * 86_400_000);
d.setDate(d.getDate() + ((8 - d.getDay()) % 7)); // a Monday
const date = d.toISOString().slice(0, 10);
const book = async (groomer) => {
  await page.goto(`${BASE}/appointments/new?client=${clientId}&date=${date}&time=10:00`);
  await page.locator("label", { hasText: groomer }).click();
  const sel = page.locator('select[name^="svc:"]');
  await sel.selectOption(await sel.locator("option", { hasText: "Bath - Medium" }).getAttribute("value"));
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
  return page.url().split("?")[0];
};
await book("Steffano");
const jessVisit = await book("Jess");
await page.getByText("Groomer Jess").waitFor();
step("booked 10:00 for Steffano and for Jess the same day, no clash");

await page.goto(`${BASE}/calendar?view=day&date=${date}`);
await page.getByRole("link", { name: /Maria Lopez/ }).nth(1).waitFor({ timeout: 10_000 }).catch(() => {});
if ((await page.getByRole("link", { name: /Maria Lopez/ }).count()) !== 2) fail("All should show both visits");
await page.getByRole("navigation", { name: "Groomer" }).getByRole("link", { name: "Jess" }).click();
await page.waitForURL(/groomer=/);
if ((await page.getByRole("link", { name: /Maria Lopez/ }).count()) !== 1) fail("Jess's calendar should show one visit");
await shot("calendar-groomer");
step("calendar: All shows 2, Jess shows 1");

await page.goto(`${BASE}/today?date=${date}`);
if ((await page.locator("ol > li").count()) !== 1) fail("Today defaults to your own route (1 stop)");
await page.getByRole("navigation", { name: "Groomer" }).getByRole("link", { name: "All" }).click();
await page.waitForURL(/groomer=all/);
if ((await page.locator("ol > li").count()) !== 2) fail("All routes: 2 stops");
step("Today: your route by default, All shows both");

// Give Jess's visit to Steffano: he's busy then, so it's refused.
await page.goto(jessVisit);
await page.getByRole("button", { name: "Give to" }).click();
await page.getByText("That groomer already has a visit at this time.").waitFor();
step("giving a visit to a busy groomer is refused");

// Backups
const data = await page.request.get(`${BASE}/api/device/backup?key=${KEY}&file=data`);
const json = await data.json();
if (json.format !== "woofers-backup" || !json.tables.clients.length || !json.tables.appointments.length) fail("backup JSON wrong");
if ("device_key" in json.tables.businesses[0] || JSON.stringify(json).includes("password_hash")) fail("backup leaks secrets");
const csv = await (await page.request.get(`${BASE}/api/device/backup?key=${KEY}&file=clients`)).text();
if (!csv.includes("Maria")) fail("clients CSV wrong");
if ((await page.request.get(`${BASE}/api/device/backup?key=wrong-key-wrong-key-wrong-key-123`)).status() !== 401) fail("wrong key must be refused");
await page.goto(`${BASE}/settings/backups`);
await page.getByText(/Working\. Last backup/).waitFor();
step(`backup: ${json.counts.clients} clients, ${json.counts.appointments} visits, no secrets; CSV; settings shows it ran`);

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
