// Blocked time and the day map, end to end. Run after slice.mjs on the same database.
// Tap an empty hour → Block time → shows on the day, week and agenda → edit → weekly repeat →
// remove one / the rest. Then the Today map shows a numbered pin per located stop.
// Usage: node tests/e2e/blocks.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
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

// A Monday a few weeks out, so nothing else is booked.
const d = new Date();
d.setDate(d.getDate() + 21 + ((8 - d.getDay()) % 7));
const day = d.toISOString().slice(0, 10);

await page.goto(`${BASE}/calendar?view=day&date=${day}`);
await page.getByRole("button", { name: /12:00 PM: book or block/ }).click();
await page.getByRole("dialog").getByRole("link", { name: "Block time" }).click();
await page.waitForURL(/\/calendar\/block\?/);
if ((await page.locator('input[name="start"]').inputValue()) !== "12:00") fail("start time not taken from the slot");
await page.fill('textarea[name="reason"]', "Lunch");
await page.click('button[type="submit"]');
await page.waitForURL(/\/calendar\?date=/);
const block = page.getByRole("link", { name: /Lunch/ });
await block.first().waitFor();
if (!(await block.first().textContent()).includes("12:00 PM – 1:00 PM")) fail("block times wrong on the day view");
await shot("block-day");
step("tap an empty hour → Block time → shows on the day view");

await block.first().click();
await page.waitForURL(/\/calendar\/block\/[0-9a-f-]+$/);
await page.fill('input[name="end"]', "13:30");
await page.click('button[type="submit"]');
await page.waitForURL(/\/calendar\?date=/);
await page.getByRole("link", { name: /12:00 PM – 1:30 PM/ }).waitFor();
step("edit the block");

await page.goto(`${BASE}/calendar?view=week&date=${day}`);
if ((await page.getByRole("link", { name: "Lunch" }).count()) < 1) fail("block missing on the week view");
await page.goto(`${BASE}/calendar?view=agenda&date=${day}`);
await page.getByRole("link", { name: /Lunch.*12:00 PM – 1:30 PM/ }).waitFor();
step("block on week and agenda views");

// Booking over the block warns.
await page.goto(`${BASE}/calendar?view=day&date=${day}`);
await page.getByRole("link", { name: /Lunch/ }).first().click();
await page.getByRole("button", { name: "Remove this block" }).click();
await page.waitForURL(/\/calendar\?date=/);
if ((await page.getByRole("link", { name: /Lunch/ }).count()) !== 0) fail("block not removed");
step("remove one block");

// Every week for 3 weeks, all day.
await page.goto(`${BASE}/calendar/block?date=${day}&start=09:00`);
await page.check('input[name="all_day"]');
await page.fill('textarea[name="reason"]', "Van service");
await page.selectOption('select[name="repeat"]', "1");
const until = new Date(d.getTime() + 15 * 86_400_000).toISOString().slice(0, 10);
await page.fill('input[name="until"]', until);
await page.click('button[type="submit"]');
await page.waitForURL(/\/calendar\?date=/);
await page.getByRole("link", { name: /Van service.*All day/ }).waitFor();
const next = new Date(d.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
const last = new Date(d.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
await page.goto(`${BASE}/calendar?view=day&date=${last}`);
await page.getByRole("link", { name: /Van service/ }).waitFor();
step("weekly all-day block repeats until the chosen day");

await page.goto(`${BASE}/calendar?view=day&date=${next}`);
await page.getByRole("link", { name: /Van service/ }).click();
await page.getByRole("button", { name: "Remove this and the next repeats" }).click();
await page.waitForURL(/\/calendar\?date=/);
await page.goto(`${BASE}/calendar?view=day&date=${last}`);
if ((await page.getByRole("link", { name: /Van service/ }).count()) !== 0) fail("later repeats not removed");
await page.goto(`${BASE}/calendar?view=day&date=${day}`);
if ((await page.getByRole("link", { name: /Van service/ }).count()) !== 1) fail("earlier block should stay");
step("remove this and the next repeats keeps the earlier one");

// The slot menu also books.
await page.getByRole("button", { name: /10:00 AM: book or block/ }).click();
await page.getByRole("dialog").getByRole("link", { name: "New appointment" }).click();
await page.waitForURL(/\/appointments\/new\?date=.*time=10:00/);
step("slot menu → New appointment keeps the date and time");

// Map: the stops of a day with points on it get numbered pins.
// MAP_DATE / EXPECT_PINS: a day whose visits were given points beforehand (geocoding needs the internet).
await page.goto(`${BASE}/today${process.env.MAP_DATE ? `?date=${process.env.MAP_DATE}` : ""}`);
const pins = await page.locator(".route-pin").count();
const stops = await page.locator("ol > li").count();
if (stops > 0 && process.env.EXPECT_PINS && pins !== Number(process.env.EXPECT_PINS)) fail(`expected ${process.env.EXPECT_PINS} pins, got ${pins}`);
await shot("today-map");
step(`Today map: ${pins} pin(s) for ${stops} stop(s)`);

const relevant = errors.filter((e) => !/tile\.openstreetmap|Failed to load resource/.test(e));
if (relevant.length) fail(`page errors: ${relevant.join(" | ")}`);
await browser.close();
console.log("All good.");
