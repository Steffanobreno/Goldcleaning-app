// Online booking, end to end. Run after slice.mjs on the same database (it reuses that owner).
// A new client books Regular weekly with extras on /book → the owner sees and accepts it.
// Then: two clients take the same time at once (one wins), prices change before submit (the
// client sees the new total first), and an out-of-area ZIP is refused without saving it.
// Usage: DATABASE_URL=... node tests/e2e/booking.mjs [baseUrl] [screenshotDir]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "test-results/screens";
mkdirSync(SHOTS, { recursive: true });
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/409|Conflict/.test(m.text()) && errors.push(m.text()));
  return p;
};
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

/** Fills the page up to the Request button. Returns the label of the day picked. */
async function fillBooking(page, { first, phone, zip = "94401", city = "San Mateo", extras = ["Inside Oven", "Inside Fridge"], dayIndex = 0, time = "Morning" }) {
  await page.goto(`${BASE}/book`);
  await page.getByRole("radio", { name: "Regular Clean" }).click();
  await page.getByRole("radio", { name: /^Weekly/ }).click();
  await page.getByLabel("Bedrooms").selectOption("3");
  await page.getByLabel("Full baths").selectOption("2");
  await page.getByLabel("Half baths").selectOption("1");
  for (const x of extras) await page.getByRole("button", { name: new RegExp(`^${x}`) }).click();
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last name").fill("Test");
  await page.getByLabel("Email").fill(`${first.toLowerCase()}@example.com`);
  await page.getByLabel("Mobile phone").fill(phone);
  await page.getByRole("button", { name: "See available times" }).click();
  const days = page.locator("button[aria-label*='open time']:not([disabled])");
  await days.first().waitFor();
  const day = days.nth(dayIndex);
  const label = await day.getAttribute("aria-label");
  await day.click();
  await page.getByRole("button", { name: new RegExp(`^${time} ·`) }).click();
  await page.getByLabel("Street address").fill("100 Ellsworth Ave");
  await page.getByLabel("City").fill(city);
  await page.getByLabel("ZIP").fill(zip);
  await page.getByLabel("ZIP").blur();
  await page.getByRole("radio", { name: "Lockbox" }).click();
  await page.getByLabel("Code or where the key is").fill("2468");
  return label;
}
const request = (page) => page.getByRole("button", { name: "Request booking" }).click();

// 1. A new client books.
const page = await newPage();
await fillBooking(page, { first: "Bea", phone: "(650) 555-0201" });
await page.getByTestId("book-total").getByText("$323.40").waitFor();
await page.screenshot({ path: `${SHOTS}/book-filled.png`, fullPage: true });
await request(page);
await page.getByText("Thank you, Bea!").waitFor();
await page.screenshot({ path: `${SHOTS}/book-thanks.png`, fullPage: true });
step("new client requested Regular weekly 3/2/1 + oven + fridge = $323.40");

const [draft] = await sql`select completed_at, summary from booking_drafts where phone = '+16505550201'`;
if (!draft?.completed_at) fail("draft not marked completed");
const [appt] = await sql`
  select a.status, a.source, a.frequency, extract(epoch from a.end_at - a.start_at) / 60 as minutes,
    (select sum(l.price_cents) from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
     where ah.appointment_id = a.id)::int as total,
    (select h.access_method || ':' || h.access_code from appointment_homes ah join homes h on h.id = ah.home_id
     where ah.appointment_id = a.id) as access
  from appointments a join clients c on c.id = a.client_id where c.phone = '+16505550201'`;
if (appt.status !== "requested" || appt.source !== "online" || appt.total !== 32340 || appt.frequency !== "weekly")
  fail(`stored request wrong: ${JSON.stringify(appt)}`);
if (Number(appt.minutes) !== 180 || appt.access !== "lockbox:2468") fail(`length or access wrong: ${JSON.stringify(appt)}`);
step("stored as a request: 3 hours, lines total $323.40, lockbox code on the home");

// 2. The owner sees it and accepts.
const owner = await newPage();
await owner.goto(`${BASE}/login`);
await owner.fill('input[name="email"]', "owner@example.com");
await owner.fill('input[name="password"]', "correct horse battery");
await owner.click('button[type="submit"]');
await owner.waitForURL(/\/today/);
await owner.goto(`${BASE}/requests`);
await owner.getByText("Bea Test").waitFor();
await owner.getByText("$323.40").first().waitFor();
await owner.getByText("Regular Clean · Weekly · 3 bd / 2 ba / 1 half").waitFor();
await owner.screenshot({ path: `${SHOTS}/requests.png`, fullPage: true });
await owner.getByRole("button", { name: "Accept" }).first().click();
await owner.getByText("No requests waiting").waitFor();
step("owner saw the request with its price and accepted it");

// 3. Two clients press Request for the same time at once: one gets it.
const a = await newPage();
const b = await newPage();
const dayA = await fillBooking(a, { first: "Cam", phone: "(650) 555-0202", dayIndex: 1, time: "Afternoon", extras: [] });
const dayB = await fillBooking(b, { first: "Dee", phone: "(650) 555-0203", dayIndex: 1, time: "Afternoon", extras: [] });
if (dayA !== dayB) fail(`not the same day: ${dayA} / ${dayB}`);
await Promise.all([request(a), request(b)]);
const outcome = async (p) => {
  await p.getByText(/Thank you|just taken/).first().waitFor();
  return (await p.getByText(/Thank you/).count()) > 0 ? "ok" : "taken";
};
const results = (await Promise.all([outcome(a), outcome(b)])).sort().join(",");
if (results !== "ok,taken") fail(`race result: ${results}`);
step("same time at once: one request went through, the other saw 'that time was just taken'");

// 4. The price changes between the summary and Request: the client sees the new total first.
const c = await newPage();
await fillBooking(c, { first: "Eli", phone: "(650) 555-0204", dayIndex: 2 });
await c.getByTestId("book-total").getByText("$323.40").waitFor();
await sql`update service_rates r set start_cents = 16000 from services s
          where s.id = r.service_id and s.name = 'Regular Clean' and r.frequency = 'weekly'`;
try {
  await request(c);
  await c.getByText("Your new total is $330.60").waitFor();
  await c.getByTestId("book-total").getByText("$330.60").waitFor();
  const [{ n }] = await sql`select count(*)::int as n from appointments a join clients cl on cl.id = a.client_id where cl.phone = '+16505550204'`;
  if (n !== 0) fail("a request was saved at the old price");
  await request(c);
  await c.getByText("Thank you, Eli!").waitFor();
  const [{ total }] = await sql`
    select sum(l.price_cents)::int as total from appointments a join clients cl on cl.id = a.client_id
    join appointment_homes ah on ah.appointment_id = a.id join appointment_lines l on l.appointment_home_id = ah.id
    where cl.phone = '+16505550204'`;
  if (total !== 33060) fail(`saved total ${total}`);
} finally {
  await sql`update service_rates r set start_cents = 15280 from services s
            where s.id = r.service_id and s.name = 'Regular Clean' and r.frequency = 'weekly'`;
}
step("prices changed before Request: the client saw $330.60 and sent it at the new price");

// 5. An out-of-area ZIP is refused and not kept.
const d = await newPage();
await fillBooking(d, { first: "Fay", phone: "(650) 555-0205", zip: "95060", city: "Santa Cruz", dayIndex: 3 });
await request(d);
await d.getByText("outside our service area").waitFor();
const [kept] = await sql`select zip from booking_drafts where phone = '+16505550205'`;
if (!kept) fail("no draft for the out-of-area visitor");
if (kept.zip === "95060") fail("the out-of-area ZIP was saved on the draft");
const [{ n: none }] = await sql`select count(*)::int as n from clients where phone = '+16505550205'`;
if (none !== 0) fail("a client was created for an out-of-area request");
step("ZIP 95060 is refused with the call-or-text message, and not saved");

await browser.close();
await sql.end();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
