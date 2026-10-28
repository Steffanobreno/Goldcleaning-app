// Discounts and home prices, end to end. Run after slice.mjs (it reuses that owner and Ana's home, 3 bd / 2 ba / 1 half).
// The owner creates a first-time coupon and two discounts of their own → gives Ana's home a standing
// price (−$20 and 5% off) → a visit booked for it has those lines → a one-off discount on a visit →
// a new client uses the coupon on /book → Ana can't use the first-time coupon.
// Usage: DATABASE_URL=... node tests/e2e/discounts.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors = [];
const mk = async () => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const page = await mk();
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);

async function addDiscount({ name, kind, value, code, firstTime }) {
  await page.goto(`${BASE}/settings/discounts/new`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Takes off").selectOption(kind);
  await page.getByRole("textbox", { name: kind === "percent" ? "Percent" : "Dollars" }).fill(value);
  if (code) await page.getByLabel("Coupon code (optional)").fill(code);
  if (firstTime) await page.getByLabel(/First-time clients only/).check();
  await page.getByRole("button", { name: "Save discount" }).click();
  await page.waitForURL(/\/settings\/discounts$/);
}
await addDiscount({ name: "Welcome", kind: "percent", value: "10", code: "welcome10", firstTime: true });
await addDiscount({ name: "Loyal", kind: "percent", value: "5" });
await addDiscount({ name: "Thank you", kind: "amount", value: "20" });
await page.getByText("Welcome (10% off)").waitFor();
await page.getByText("WELCOME10").waitFor();
await page.getByText("· first-time clients").waitFor();
step("discounts list: a first-time coupon WELCOME10, and two discounts without a code");

// A second discount with the same code is refused.
await page.goto(`${BASE}/settings/discounts/new`);
await page.getByLabel("Name").fill("Copy");
await page.getByRole("textbox", { name: "Percent" }).fill("5");
await page.getByLabel("Coupon code (optional)").fill("WELCOME10");
await page.getByRole("button", { name: "Save discount" }).click();
await page.getByText("Another discount already uses that code.").waitFor();
step("the same code can't be used twice");

// Ana's home: a standing adjustment and a standing discount.
const [ana] = await sql`select c.id as client_id, h.id as home_id from clients c join homes h on h.client_id = c.id where c.phone = '+16505550142' limit 1`;
await page.goto(`${BASE}/clients/${ana.client_id}/homes/${ana.home_id}`);
await page.getByLabel("Adjustment per visit ($)").fill("-20");
await page.getByLabel(/Label on the bill/).fill("Loyalty rate");
await page.getByLabel("Loyal (5% off)").check();
await page.getByRole("button", { name: "Save price" }).click();
await page.getByText("Price saved.").waitFor();
step("Ana's home saved with −$20 (Loyalty rate) and Loyal 5%");

// A visit for that home: Regular weekly, 3/2/1 = 238.40; −20.00; −5% of 238.40 = 11.92 → 206.48
const day = new Date();
do day.setDate(day.getDate() + 1);
while (day.getDay() !== 4);
const date = day.toISOString().slice(0, 10);
await page.goto(`${BASE}/appointments/new?client=${ana.client_id}&home=${ana.home_id}&date=${date}&time=09:00`);
await page.selectOption('select[name="service"]', { label: "Regular Clean" });
await page.getByText("Weekly", { exact: true }).click();
await page.getByTestId("total").getByText("$206.48").waitFor();
await page.getByText("Loyalty rate").waitFor();
await page.locator("span", { hasText: /^Loyal \(5% off\)$/ }).waitFor();
// a discount for this visit only: Thank you −$20 → 186.48
await page.getByLabel("Discount for this visit only (optional)").selectOption({ label: "Thank you ($20.00 off)" });
await page.getByTestId("total").getByText("$186.48").waitFor();
await page.getByRole("button", { name: "Book cleaning" }).click();
// Earlier suites may have booked that morning: the form warns, and the owner books anyway.
await Promise.race([page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/), page.getByLabel("Book anyway").waitFor()]);
if (await page.getByLabel("Book anyway").count()) {
  await page.getByLabel("Book anyway").check();
  await page.getByRole("button", { name: "Book cleaning" }).click();
  await page.waitForURL(/\/appointments\/[0-9a-f-]+\?booked=1/);
}
await page.getByTestId("appt-total").getByText("$186.48").waitFor();
const apptId = page.url().split("?")[0].split("/").pop();
const lines = await sql`select l.kind, l.price_cents from appointment_lines l join appointment_homes ah on ah.id = l.appointment_home_id
                        where ah.appointment_id = ${apptId} and l.kind in ('rate', 'discount', 'coupon') order by l.kind`;
const got = lines.map((l) => `${l.kind}:${l.price_cents}`).join(",");
if (got !== "coupon:-2000,discount:-1192,rate:-2000") fail(`price lines wrong: ${got}`);
step("visit booked at $186.48: standing rate −$20, standing discount −$11.92, this visit's discount −$20");

// Edit price keeps all three, and the discount can be removed for this visit.
await page.getByRole("link", { name: "Edit price" }).first().click();
await page.getByTestId("total").getByText("$186.48").waitFor();
await page.getByLabel("Discount for this visit only (optional)").selectOption("");
await page.getByTestId("total").getByText("$206.48").waitFor();
await page.getByRole("button", { name: "Save" }).click();
await page.waitForLoadState("networkidle");
await page.goto(`${BASE}/appointments/${apptId}`); // an overlap warning keeps the form open; the price is saved either way
await page.getByTestId("appt-total").getByText("$206.48").waitFor();
step("Edit price keeps the home's price and lets the visit's discount be removed");

// A new client uses the first-time coupon on /book: Regular one-time 3/2/1 = 298.00; 10% = 29.80 → 268.20
async function fill(p, { first, phone }) {
  await p.goto(`${BASE}/book`);
  await p.getByRole("radio", { name: "Regular Clean" }).click();
  await p.getByLabel("Bedrooms").selectOption("3");
  await p.getByLabel("Full baths").selectOption("2");
  await p.getByLabel("Half baths").selectOption("1");
  await p.getByLabel("First name").fill(first);
  await p.getByLabel("Last name").fill("Coupon");
  await p.getByLabel("Email").fill(`${first.toLowerCase()}@example.com`);
  await p.getByLabel("Mobile phone").fill(phone);
  await p.getByRole("button", { name: "See available times" }).click();
  const days = p.locator("button[aria-label*='open time']:not([disabled])");
  await days.first().waitFor();
  await days.first().click();
  await p.getByRole("button", { name: /^(Morning|Afternoon) ·/ }).first().click();
  await p.getByLabel("Street address").fill("200 Ellsworth Ave");
  await p.getByLabel("City").fill("San Mateo");
  await p.getByLabel("ZIP").fill("94401");
  await p.getByRole("radio", { name: "Lockbox" }).click();
  await p.getByLabel("Code or where the key is").fill("1357");
}
const cy = await mk();
await fill(cy, { first: "Cy", phone: "(650) 555-0301" });
await cy.getByLabel("Promo code (optional)").fill("nope");
await cy.getByRole("button", { name: "Apply" }).click();
await cy.getByText("That code isn't valid.").waitFor();
await cy.getByLabel("Promo code (optional)").fill("welcome10");
await cy.getByRole("button", { name: "Apply" }).click();
await cy.getByText("Welcome (10% off): −$29.80").waitFor();
await cy.getByTestId("book-total").getByText("$268.20").waitFor();
await cy.getByRole("button", { name: "Request booking" }).click();
await cy.getByText("Thank you, Cy!").waitFor();
const cl = await sql`select l.kind, l.price_cents from appointments a join clients c on c.id = a.client_id
                     join appointment_homes ah on ah.appointment_id = a.id join appointment_lines l on l.appointment_home_id = ah.id
                     where c.phone = '+16505550301' and l.kind in ('coupon')`;
if (cl.length !== 1 || cl[0].price_cents !== -2980) fail(`coupon line wrong: ${JSON.stringify(cl)}`);
const [used] = await sql`select uses from discounts where lower(code) = 'welcome10'`;
if (used.uses < 1) fail("use not counted");
step("a new client used WELCOME10 on /book: $298.00 → $268.20, coupon line saved, use counted");

// Ana already has visits, so the first-time coupon is refused.
const ann = await mk();
await fill(ann, { first: "Ana", phone: "(650) 555-0142" });
await ann.getByLabel("Promo code (optional)").fill("WELCOME10");
await ann.getByRole("button", { name: "Apply" }).click();
await ann.getByText("That code is for first-time clients only.").waitFor();
step("an existing client can't use the first-time coupon");

// Put Ana's home back to the price list for the next suites.
await page.goto(`${BASE}/clients/${ana.client_id}/homes/${ana.home_id}`);
await page.getByLabel("Adjustment per visit ($)").fill("");
await page.getByLabel("Loyal (5% off)").uncheck();
await page.getByRole("button", { name: "Save price" }).click();
await page.getByText("Price saved.").waitFor();

await browser.close();
await sql.end();
if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
console.log("All good.");
