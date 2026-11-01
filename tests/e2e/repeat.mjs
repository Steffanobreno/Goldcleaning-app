// Recurring cleanings from the booked frequency, end to end. Run after slice.mjs (owner).
// A client requests "every 2 weeks" on a Tuesday morning → one of the series' dates is
// already taken → the owner accepts → the next cleanings are booked every 2 weeks up to the
// booking window with the same price, the taken date is reported and not booked → Stop
// repeating removes the copies.
// Usage: DATABASE_URL=... node tests/e2e/repeat.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });
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

// The client asks for every 2 weeks, 2/1, on the first open Tuesday morning.
await page.goto(`${BASE}/book`);
await page.getByRole("radio", { name: /^Every 2 weeks/ }).click();
await page.getByLabel("Bedrooms").selectOption("2");
await page.getByLabel("First name").fill("Rita");
await page.getByLabel("Last name").fill("Repeat");
await page.getByLabel("Email").fill("rita@example.com");
await page.getByLabel("Mobile phone").fill("6505550401");
await page.getByRole("button", { name: "See available times" }).click();
await page.locator("button[aria-label*='open time']").first().waitFor();
const tuesday = page.locator("button[aria-label^='Tuesday']:not([disabled])").first();
while (!(await tuesday.count())) await page.getByRole("button", { name: "Next month" }).click();
await tuesday.click();
await page.getByRole("button", { name: /^Morning ·/ }).click();
await page.getByLabel("Street address").fill("12 Laurel St");
await page.getByLabel("City").fill("San Carlos");
await page.getByLabel("ZIP").fill("94070");
await page.getByRole("radio", { name: "Someone will be home" }).click();
await page.getByTestId("book-total").getByText("$183.00").waitFor(); // 163 + 1 bedroom × 20
await page.getByRole("button", { name: "Request booking" }).click();
await page.getByText("Thank you, Rita!").waitFor();
const [req] = await sql`
  select a.id, a.start_at, a.end_at, a.staff_id, a.business_id from appointments a join clients c on c.id = a.client_id
  where c.phone = '+16505550401'`;
step("Rita requested every 2 weeks, 2 bd / 1 ba, Tuesday 9:00, $183.00");

// Four weeks later the morning is already taken by another client.
const later = (weeks) => new Date(req.start_at.getTime() + weeks * 7 * 86_400_000);
const [other] = await sql`
  insert into clients (business_id, first_name, last_name, phone) values (${req.business_id}, 'Other', 'Client', '+16505550499')
  returning id`;
await sql`insert into appointments (business_id, client_id, staff_id, start_at, end_at, status, source)
          values (${req.business_id}, ${other.id}, ${req.staff_id}, ${later(4)}, ${new Date(later(4).getTime() + 3 * 3600_000)}, 'confirmed', 'manual')`;

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/requests`);
await page.getByText("Regular Clean · Every 2 weeks · 2 bd / 1 ba").waitFor();
await page.getByRole("article", { name: "Rita Repeat" }).getByRole("button", { name: "Accept" }).click();
await page.waitForURL(/\/appointments\/[0-9a-f-]+\?accepted=1/);
await page.getByText(/Request accepted, and \d+ more cleanings? booked in the series/).waitFor();
await page.getByText(/Already taken, so not booked: /).waitFor();
step("accepted: the series is booked and the taken date is reported");

// The emails to Rita: "repeating cleaning" while the request waits, and her next dates once it is accepted.
const mailLog = process.env.MAIL_LOG ?? "test-results/mails.jsonl";
const ritaMails = async (needle) => {
  for (let i = 0; i < 20; i++) {
    const mails = existsSync(mailLog) ? readFileSync(mailLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    const hit = mails.find((m) => m.to === "rita@example.com" && m.html.includes(needle));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};
if (!(await ritaMails("This is a repeating cleaning (every 2 weeks)"))) fail("the request email should say the cleaning repeats");
const next = await ritaMails("Your next cleanings (every 2 weeks)");
if (!next) fail("the accepted email should list her next cleanings");
if ((next.html.match(/&bull;|•/g) ?? []).length < 2) fail("the accepted email should list two next dates");
step("emails: the request says it repeats; the accepted one lists her next two cleanings");

const rows = await sql`
  select a.start_at, a.status,
    (select sum(l.price_cents) from appointment_homes ah join appointment_lines l on l.appointment_home_id = ah.id
     where ah.appointment_id = a.id)::int as total
  from appointments a join clients c on c.id = a.client_id where c.phone = '+16505550401' order by a.start_at`;
const weeks = rows.map((r) => Math.round((r.start_at - req.start_at) / (7 * 86_400_000)));
const [{ ahead }] = await sql`select booking_days_ahead as ahead from businesses limit 1`;
const expected = [0, 2, 6, 8].filter((w) => req.start_at.getTime() + w * 7 * 86_400_000 <= Date.now() + (ahead + 1) * 86_400_000);
if (weeks.join() !== expected.join()) fail(`series weeks ${weeks.join()} (expected ${expected.join()}: week 4 was taken)`);
if (rows.some((r) => r.total !== 18300 || r.status !== "confirmed")) fail(`copies wrong: ${JSON.stringify(rows)}`);
step(`booked every 2 weeks (weeks ${weeks.join(", ")}), all confirmed at $183.00; week 4 skipped`);

await page.goto(`${BASE}/calendar?view=agenda&date=${later(2).toISOString().slice(0, 10)}`);
await page.getByRole("link", { name: /Rita/ }).first().waitFor();
step("the calendar shows the next cleaning in the series");

// Moving visits of the series: one on the Upcoming list, then one with the ones after it.
const ymdOf = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const plusDay = (d, n) => ymdOf(new Date(d.getTime() + n * 86_400_000));
const [rita] = await sql`select c.id from clients c where c.phone = '+16505550401'`;
const seriesRows = () => sql`select a.id, a.start_at from appointments a where a.client_id = ${rita.id} order by a.start_at`;
let sr = await seriesRows();
await page.goto(`${BASE}/clients/${rita.id}/upcoming`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const row = page.locator("li", { hasText: "Repeats" }).nth(1); // moved a day later: it keeps its place in the list
await row.locator('input[name="date"]').fill(plusDay(sr[1].start_at, 1));
await row.getByRole("button", { name: "Move" }).click();
await row.getByText("Moved.").waitFor({ timeout: 8000 }).catch(async () => fail("row: " + (await row.innerText())));
let after = await seriesRows();
if (ymdOf(after[1].start_at) !== plusDay(sr[1].start_at, 1)) fail("the visit was not moved a day later");
if (after[2].start_at.getTime() !== sr[2].start_at.getTime()) fail("another visit moved when only one was asked");
step("Upcoming visits: one visit moved a day later, the others stayed");

await page.goto(`${BASE}/appointments/${sr[0].id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByLabel(/This one and the next/).check();
await page.locator('input[name="date"]').fill(plusDay(sr[0].start_at, 1));
await page.getByRole("button", { name: "Move appointment" }).click();
await page.getByText(new RegExp(`Moved ${sr.length} visits of this series`)).waitFor({ timeout: 8000 }).catch(async () => fail("page: " + page.url() + " " + (await page.locator("main").innerText()).slice(0, 500)));
after = await seriesRows();
// Visit 2 was already a day later, so it is two days later now; the rest follow by one day.
if (!sr.every((r, i) => ymdOf(after[i].start_at) === plusDay(r.start_at, i === 1 ? 2 : 1))) fail("the following visits did not move along");
step("This one and the next moved a day later together");

// Stop repeating removes the later copies (none was confirmed one by one or paid).
await page.goto(`${BASE}/appointments/${req.id}/repeat`);
await page.getByRole("button", { name: /Stop repeating/ }).click();
await page.getByText("This visit no longer repeats.").waitFor();
const [{ n }] = await sql`select count(*)::int as n from appointments a join clients c on c.id = a.client_id where c.phone = '+16505550401'`;
if (n !== 1) fail(`after stopping, ${n} cleanings are left`);
step("Stop repeating removed the later cleanings");

await browser.close();
await sql.end();
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
console.log("All good.");
