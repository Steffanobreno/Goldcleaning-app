// Repeating visits and "add to my calendar", end to end. Run after slice.mjs and booking.mjs.
// APPT = id of a booked (unconfirmed or confirmed) visit, TOKEN = its public token.
// Repeat every 2 weeks, 4 times → 3 more booked → change to every week, 3 times → the later
// copies are replaced → stop repeating removes them. The visit's .ics file and the email buttons.
// Usage: APPT=... TOKEN=... node tests/e2e/repeat.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "replica/clone-screens";
const { APPT, TOKEN } = process.env;
if (!APPT || !TOKEN) throw new Error("Set APPT and TOKEN");
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

await page.goto(`${BASE}/appointments/${APPT}`);
await page.getByRole("link", { name: /Repeat this appointment/ }).click();
await page.waitForURL(/\/repeat$/);
await page.getByRole("button", { name: "Every 2 weeks" }).click();
await page.locator('input[name="count"]').fill("4");
await page.getByRole("heading", { name: "4 visits" }).waitFor();
await shot("repeat-form");
await page.getByRole("button", { name: "Save and book 3 more" }).click();
await page.getByText(/Booked \d+ more visits?: every 2 weeks/).waitFor();
const booked = Number((await page.getByText(/Booked \d+ more/).textContent()).match(/Booked (\d+)/)[1]);
const skipped = await page.locator("li", { hasText: "·" }).count();
if (booked + skipped !== 3) fail(`expected 3 booked or skipped, got ${booked} + ${skipped}`);
await shot("repeat-done");
step(`every 2 weeks, 4 times: ${booked} booked, ${skipped} skipped (taken)`);

await page.getByRole("link", { name: "Done" }).click();
await page.getByText(new RegExp(`Every 2 weeks on \\w+day, 4 times · ${booked} more after this one`)).waitFor();
step("appointment shows the repeat rule and how many are coming up");

// Change the rule: the later copies are replaced, not added to.
await page.getByRole("link", { name: /Repeat appointment/ }).click();
await page.getByRole("button", { name: "Every week" }).click();
await page.locator('input[name="count"]').fill("3");
await page.getByRole("button", { name: "Save and book 2 more" }).click();
await page.getByText(/Booked \d+ more visits?: every week/).waitFor();
const booked2 = Number((await page.getByText(/Booked \d+ more/).textContent()).match(/Booked (\d+)/)[1]);
await page.getByRole("link", { name: "Done" }).click();
await page.getByText(new RegExp(`Every week on \\w+day, 3 times · ${booked2} more after this one`)).waitFor();
step(`changed to every week, 3 times: old copies replaced (${booked2} after this one)`);


await page.goto(`${BASE}/appointments/${APPT}/repeat`);
await page.getByRole("button", { name: /Stop repeating/ }).click();
await page.getByText("This visit no longer repeats").waitFor();
await page.goto(`${BASE}/appointments/${APPT}`);
await page.getByRole("link", { name: /Repeat this appointment/ }).waitFor();
step("stop repeating removes the later visits");

// The client's "add to my calendar" file and buttons.
const ics = await page.request.get(`${BASE}/a/${TOKEN}/calendar`);
const body = await ics.text();
if (!ics.ok() || !ics.headers()["content-type"].startsWith("text/calendar")) fail(`ics: ${ics.status()}`);
if (!/BEGIN:VEVENT[\s\S]*SUMMARY:.*grooming[\s\S]*BEGIN:VALARM[\s\S]*END:VCALENDAR/.test(body)) fail("ics content wrong");
step("visit .ics file with grooming title and reminders");
await page.goto(`${BASE}/a/${TOKEN}`);
await page.getByRole("link", { name: /Add to iPhone/ }).waitFor();
const google = await page.getByRole("link", { name: /Google Calendar/ }).getAttribute("href");
if (!google.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")) fail("google link wrong");
await shot("client-calendar-buttons");
step("client page: Add to iPhone and Google Calendar");

await page.goto(`${BASE}/settings/messages/preview?trigger=booked`);
const html = await page.locator("iframe").getAttribute("srcdoc");
if (!html.includes("Google Calendar") || !html.includes("Apple / iPhone")) fail("email has no calendar buttons");
step("booking email has the calendar buttons");

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
