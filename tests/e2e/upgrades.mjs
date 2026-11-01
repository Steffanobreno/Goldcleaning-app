// The upgrades brought over from the Woofers app, end to end. Run after slice.mjs and discounts.mjs
// (it reuses Ana Silva's finished, paid visit). Settings search, auto-accepted bookings and the QR
// code, the PIN lock, the receipt (page and PDF), report downloads, closed dates, the waitlist,
// client tags and the A–Z finder, repeating on picked dates, the booking page in Spanish and
// Chinese, and photos of a cleaning.
// Usage: DATABASE_URL=... node tests/e2e/upgrades.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
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

// 1. Settings: grouped, searchable.
await page.goto(`${BASE}/settings`);
await page.getByText("Basic settings").waitFor();
await page.getByPlaceholder("Search settings").fill("coupon");
await page.getByRole("link", { name: /Discounts/ }).waitFor();
if (await page.getByRole("link", { name: /Working hours/ }).count()) fail("search should hide Working hours");
step("settings are in groups, and the search narrows them");

// 2. The QR code of the booking page.
const qr = await page.request.get(`${BASE}/settings/booking/qr`);
if (qr.headers()["content-type"] !== "image/png") fail("QR should be a PNG");
step("the booking page has a QR code (PNG)");

// 3. Receipt of Ana's paid visit: page and PDF.
const [paid] = await sql`
  select a.id as appt, i.public_token as token, i.receipt_no from invoices i join appointments a on a.id = i.appointment_id
  join clients c on c.id = a.client_id where c.phone = '+16505550142' and i.status = 'closed' order by i.closed_at limit 1`;
if (!paid) fail("no paid visit for Ana");
await page.goto(`${BASE}/appointments/${paid.appt}/checkout`);
await page.getByRole("heading", { name: `Receipt #${paid.receipt_no}` }).first().waitFor();
await page.getByRole("button", { name: /Email receipt|Email again/ }).waitFor();
const rpage = await ctx.newPage();
await rpage.goto(`${BASE}/r/${paid.token}`);
await rpage.getByText(`Receipt #${paid.receipt_no}`).first().waitFor();
await rpage.getByText("Paid · Thank you!").waitFor();
await rpage.goto(`${BASE}/r/${paid.token}?lang=es`);
await rpage.getByText("Pagado · ¡Gracias!").waitFor();
const pdf = await page.request.get(`${BASE}/r/${paid.token}/pdf`);
if (!(await pdf.body()).subarray(0, 5).toString().startsWith("%PDF")) fail("receipt PDF is not a PDF");
await page.getByRole("button", { name: /Email receipt|Email again/ }).click();
await page.waitForURL(/receipt=/);
await page.getByText(/Receipt emailed\./).waitFor();
const [mailed] = await sql`select receipt_emailed_at from invoices where public_token = ${paid.token}`;
if (!mailed.receipt_emailed_at) fail("receipt not marked as emailed");
await page.goto(`${BASE}/receipts`);
await page.getByText(`#${paid.receipt_no}`).first().waitFor();
const all = await page.request.get(`${BASE}/receipts/pdf?from=2020-01-01&to=2099-12-31`);
if (!(await all.body()).subarray(0, 5).toString().startsWith("%PDF")) fail("all-receipts PDF is not a PDF");
step(`receipt #${paid.receipt_no}: page (English and Spanish), PDF, emailed, listed, all as one PDF`);

// 4. Reports download.
const csv = await page.request.get(`${BASE}/reports/export?period=year&format=csv`);
const csvText = await csv.text();
if (!csvText.includes("Summary") || !csvText.includes("Collected")) fail("report CSV looks empty");
const rpdf = await page.request.get(`${BASE}/reports/export?period=year&format=pdf`);
if (!(await rpdf.body()).subarray(0, 5).toString().startsWith("%PDF")) fail("report PDF is not a PDF");
step("reports download as CSV (Excel) and as PDF");

// 5. The booking page in other languages.
const book = await ctx.newPage();
await book.goto(`${BASE}/book?lang=es`);
await book.getByText("1 · Servicio").waitFor();
await book.getByRole("button", { name: "Ver horarios disponibles" }).waitFor();
await book.goto(`${BASE}/book?lang=zh`);
await book.getByText("1 · 服务").waitFor();
await book.goto(`${BASE}/book`);
await book.getByText("1 · Service").waitFor();
step("the booking page speaks English, Spanish and Chinese");

// 6. Visit photos on the paid visit.
await page.goto(`${BASE}/appointments/${paid.appt}`, { waitUntil: "networkidle" });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.waitForTimeout(2000); // let the page hydrate before choosing a file
await page.setInputFiles('input[type="file"]', { name: "after.png", mimeType: "image/png", buffer: png });
await page.locator('img[alt="before photo"], img[alt="after photo"]').first().waitFor({ timeout: 40000 }).catch(async () => {
  fail("photo not shown: " + (await page.locator('[role="alert"]').allTextContents()).join("|") + " errors=" + errors.join("|"));
});
const [{ n }] = await sql`select count(*)::int as n from visit_photos where appointment_id = ${paid.appt}`;
if (n !== 1) fail(`expected 1 photo, got ${n}`);
step("a before photo saved with the visit");

// 7. Closed dates: a day closed in Settings has no open times on /book.
await book.goto(`${BASE}/book`);
await book.getByRole("radio", { name: "Regular Clean" }).click();
await book.getByLabel("First name").fill("Dee");
await book.getByLabel("Last name").fill("Closed");
await book.getByLabel("Email").fill("dee@example.com");
await book.getByLabel("Mobile phone").fill("(650) 555-0393");
await book.getByRole("button", { name: "See available times" }).click();
const open = book.locator("button[aria-label*='open time']:not([disabled])");
await open.first().waitFor();
const label = (await open.first().getAttribute("aria-label")).split(",").slice(0, 2).join(",");
const day = await sql`select to_char(d, 'YYYY-MM-DD') as ymd from generate_series(current_date, current_date + 60, '1 day') d
                      where trim(to_char(d, 'FMDay')) || ', ' || trim(to_char(d, 'FMMonth')) || ' ' || to_char(d, 'FMDD') = ${label} limit 1`;
await page.goto(`${BASE}/settings/closed`);
await page.fill('input[name="start_date"]', day[0].ymd);
await page.fill('input[name="reason"]', "Vacation");
await page.getByRole("button", { name: "Add closed dates" }).click();
await page.getByText("Added.").waitFor();
await book.reload();
await book.getByRole("radio", { name: "Regular Clean" }).click();
await book.getByLabel("First name").fill("Dee");
await book.getByLabel("Last name").fill("Closed");
await book.getByLabel("Email").fill("dee@example.com");
await book.getByLabel("Mobile phone").fill("(650) 555-0393");
await book.getByRole("button", { name: "See available times" }).click();
await book.locator("button[aria-label*='open time']:not([disabled])").first().waitFor();
if (await book.locator(`button[aria-label^="${label},"]:not([disabled])`).count()) fail("the closed day should have no open times");
await page.goto(`${BASE}/today?date=${day[0].ymd}`);
await page.getByText("Closed · Vacation").waitFor();
await sql`delete from closed_dates`;
step("a closed date takes the day off /book and shows as closed on Today");

// 8. Auto-accept: everyone books right away.
await page.goto(`${BASE}/settings/booking`);
await page.getByLabel("Book everyone right away").check();
await page.getByRole("button", { name: "Save" }).first().click();
await page.getByText("Saved.").first().waitFor();
const auto = await ctx.newPage();
await auto.goto(`${BASE}/book`);
await auto.getByRole("radio", { name: "Regular Clean" }).click();
await auto.getByLabel("First name").fill("Eve");
await auto.getByLabel("Last name").fill("Auto");
await auto.getByLabel("Email").fill("eve@example.com");
await auto.getByLabel("Mobile phone").fill("(650) 555-0394");
await auto.getByRole("button", { name: "See available times" }).click();
const days = auto.locator("button[aria-label*='open time']:not([disabled])");
await days.first().waitFor();
await days.last().click();
await auto.getByRole("button", { name: /^(Morning|Afternoon) ·/ }).first().click();
await auto.getByLabel("Street address").fill("300 Ellsworth Ave");
await auto.getByLabel("City").fill("San Mateo");
await auto.getByLabel("ZIP").fill("94401");
await auto.getByRole("radio", { name: "Lockbox" }).click();
await auto.getByLabel("Code or where the key is").fill("1111");
await auto.getByRole("button", { name: "Request booking" }).click();
await auto.getByText(/You're booked/).waitFor();
const [eve] = await sql`select a.status from appointments a join clients c on c.id = a.client_id where c.phone = '+16505550394'`;
if (eve?.status !== "unconfirmed") fail(`auto-accepted booking should be booked (unconfirmed by the client), got ${eve?.status}`);
await sql`update businesses set auto_accept = 'none'`;
step("with auto-accept on, an online booking is booked right away");

// 9. Client tags, the finder and the waitlist.
await page.goto(`${BASE}/settings/lists/client_tag`);
await page.getByLabel("New item").fill("Test tag");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByRole("button", { name: "Rename Test tag" }).waitFor();
const [ana] = await sql`select id from clients where phone = '+16505550142'`;
await page.goto(`${BASE}/clients/${ana.id}/edit`);
await page.getByText("Test tag", { exact: true }).click();
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(new RegExp(`/clients/${ana.id}$`));
await page.getByText("Tags").waitFor();
await page.goto(`${BASE}/clients?tag=${encodeURIComponent("Test tag")}`);
await page.getByRole("link", { name: /Ana Silva/ }).waitFor();
await page.goto(`${BASE}/clients`);
await page.getByLabel("Search clients").fill("zzzz");
await page.getByRole("link", { name: /Ana Silva/ }).waitFor({ state: "hidden" });
await page.getByLabel("Search clients").fill("silva");
await page.getByRole("link", { name: /Ana Silva/ }).waitFor();
step("client tags: added to the list, set on Ana, filter by tag; the client list filters as you type");
await page.goto(`${BASE}/waitlist/new?client=${ana.id}`);
const wd = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
await page.fill('input[name="from_date"]', wd);
await page.fill('input[name="note"]', "Mornings only");
await page.getByRole("button", { name: "Add to waitlist" }).click();
await page.waitForURL(/\/waitlist\?added=1/);
await page.getByText("Mornings only").waitFor();
await page.getByRole("button", { name: "Remove" }).click();
await page.getByText("Nobody is waiting").waitFor();
step("waitlist: add a client and a note, then remove them");

// 10. Repeat on days picked on the calendar.
const [vis] = await sql`select a.id from appointments a join clients c on c.id = a.client_id
                        where c.phone = '+16505550391' and a.status = 'requested' order by a.start_at limit 1`;
if (vis) {
  await sql`update appointments set status = 'unconfirmed' where id = ${vis.id}`;
  await page.goto(`${BASE}/appointments/${vis.id}/repeat`);
  await page.getByRole("button", { name: "Pick dates" }).click();
  const picks = page.locator('button[aria-label*="," ]:not([disabled])[aria-pressed="false"]');
  await picks.nth(10).click();
  await picks.nth(20).click();
  await page.getByRole("button", { name: /Save and book 2 more/ }).click();
  await page.getByText(/Booked \d more visit/).waitFor();
  const [{ count }] = await sql`select count(*)::int as count from appointments where series_id = (select series_id from appointments where id = ${vis.id})`;
  const [{ freq }] = await sql`select freq from appointment_series where id = (select series_id from appointments where id = ${vis.id})`;
  if (freq !== "dates" || count < 2) fail(`repeat on dates: ${freq} ${count}`);
  step("repeat: two days picked on the calendar became two more visits");
}

// 11. The app lock (PIN), last so it can't get in the way.
await page.goto(`${BASE}/settings/account`);
await page.getByLabel("PIN (4 to 6 numbers)").fill("4321");
await page.getByLabel("PIN again").fill("4321");
await page.getByRole("button", { name: "Turn on app lock" }).click();
await page.getByText("Saved.").waitFor();
const locked = await ctx.newPage();
await locked.goto(`${BASE}/today`);
await locked.getByRole("dialog", { name: "App locked" }).waitFor();
await locked.getByLabel("PIN").fill("1111");
await locked.getByRole("button", { name: "OK" }).click();
await locked.getByText(/Wrong PIN/).waitFor();
await locked.getByLabel("PIN").fill("4321");
await locked.getByRole("button", { name: "OK" }).click();
await locked.getByRole("dialog", { name: "App locked" }).waitFor({ state: "hidden" });
await page.goto(`${BASE}/settings/account`);
await page.getByRole("button", { name: "Turn off app lock" }).click();
await page.getByText("Saved.").first().waitFor().catch(() => null);
const [{ pin }] = await sql`select count(*)::int as pin from staff where pin_hash is not null`;
if (pin !== 0) fail("the PIN should be off again");
step("app lock: asks for the PIN, refuses a wrong one, opens with the right one, turns off");

// 9. An older client's own price: set on the home, used instead of the price list; or saved from the booking form.
const [ben] = await sql`select c.id as client_id, h.id as home_id from clients c join homes h on h.client_id = c.id where c.phone = '+16505550143' limit 1`;
await page.goto(`${BASE}/clients/${ben.client_id}/homes/${ben.home_id}`);
await page.getByLabel(/^Usual price per visit/).fill("140");
await page.getByRole("button", { name: "Save price" }).click();
await page.getByText("Price saved.").waitFor();
const friday = new Date();
friday.setDate(friday.getDate() + 28);
while (friday.getDay() !== 5) friday.setDate(friday.getDate() + 1);
const fdate = friday.toISOString().slice(0, 10);
await page.goto(`${BASE}/appointments/new?client=${ben.client_id}&home=${ben.home_id}&date=${fdate}&time=13:00`, { waitUntil: "networkidle" });
await page.selectOption('select[name="service"]', { label: "Regular Clean" });
await page.getByText("Weekly", { exact: true }).click();
await page.getByText(/usual price is \$140\.00/).waitFor();
await page.getByTestId("total").getByText("$140.00").waitFor();
await page.locator("summary", { hasText: "Extras" }).click();
await page.getByRole("button", { name: "More Inside Oven" }).click();
await page.getByTestId("total").getByText("$180.00").waitFor();
step("a home with a usual price books at that price (extras on top), not the price list");
await page.getByRole("button", { name: "Fewer Inside Oven" }).click();
// Typing a price and ticking "Always use this price" saves it as the home's usual price.
await page.fill('input[name="final_price"]', "130");
await page.getByTestId("total").getByText("$130.00").waitFor();
await page.getByLabel(/Always use this price for this home/).check();
await page.getByRole("button", { name: "Book cleaning" }).click();
await Promise.race([page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/), page.getByLabel("Book anyway").waitFor()]);
if (await page.getByLabel("Book anyway").count()) {
  await page.getByLabel("Book anyway").check();
  await page.getByRole("button", { name: "Book cleaning" }).click();
  await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
}
await page.getByTestId("appt-total").getByText("$130.00").waitFor();
const [{ usual }] = await sql`select usual_price_cents as usual from homes where id = ${ben.home_id}`;
if (usual !== 13000) fail(`the usual price should be saved as 13000, got ${usual}`);
step("the typed price $130.00 was kept for the visit and saved as the home's usual price");

await browser.close();
await sql.end();
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
console.log("All good.");
