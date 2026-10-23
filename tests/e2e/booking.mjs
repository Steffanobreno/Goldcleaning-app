// Online booking, end to end. Run after slice.mjs on the same database (it reuses that owner).
// Client requests on /book → owner accepts → iPhone outbox returns the texts once →
// client confirms from the link → calendar feed lists it → a far ZIP can't take that day.
// Usage: node tests/e2e/booking.mjs [baseUrl] [screenshotDir]
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
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: "initial" });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};

const button = (name) => page.getByRole("button", { name, exact: true });

// The booking page asks one thing per screen; this walks a new client through it.
async function requestVisit({ pet, size, zip, city, phone, pickDay, photo }) {
  await page.goto(`${BASE}/book`);
  await page.getByLabel("Mobile phone").fill(phone);
  await button("Next").click();
  await page.getByText("It looks like your first visit with us.").waitFor();
  await page.getByLabel("First name").fill("Ana");
  await page.getByLabel("Last name").fill("Silva");
  await page.getByLabel("Email").fill("ana@example.com");
  await button("Continue").click();
  await page.getByLabel("Street address").fill("1 Main St");
  await page.getByLabel("City").fill(city);
  await page.getByLabel("ZIP code").fill(zip);
  await button("Continue").click();
  await page.getByLabel("Breed").fill("malt");
  await button("Maltese").click();
  await page.getByLabel("Pet's name").fill(pet);
  await page.getByRole("radio", { name: new RegExp(`^${size}`) }).click();
  await button(`Save ${pet}`).click();
  await button("Continue to service").click();
  await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: "Bath", exact: true }).click();
  await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
  await button("Continue").click();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  if (photo) {
    await page.setInputFiles('input[type="file"]', photo);
    await page.getByAltText("Your pet").waitFor();
  }
  await button(`Confirm info for ${pet}`).click();
  await page.getByRole("heading", { name: "Select a time" }).waitFor();
  const days = await page.locator("button[aria-label*='open time']:not([disabled])").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").split(",").slice(0, 2).join(",")));
  if (pickDay === null) return days;
  const chosenDay = (await page.locator("button[aria-pressed='true'][aria-label*='open time']").getAttribute("aria-label")).split(",").slice(0, 2).join(",");
  await page.getByRole("group", { name: "Open times" }).locator("button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Read and sign/ }).click();
  await page.getByLabel("I have read and agree to the service agreement.").check();
  await page.getByLabel("Type your full name to sign").fill("Ana Silva");
  await sign();
  await button("Sign agreement").click();
  await page.getByText("Signed by Ana Silva").waitFor();
  await shot("S35-book-review");
  await button("Submit booking request").click();
  await page.getByText("Waiting for confirmation").waitFor();
  return chosenDay;
}

async function sign() {
  const pad = page.getByLabel("Draw your signature here");
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 18, box.y + 60 + (i % 2 ? 25 : -25));
  await page.mouse.up();
}

// A small picture to use as the pet photo.
const photoPath = `${SHOTS}/fake-pet.png`;
await page.setContent('<div style="width:300px;height:300px;background:#c90"></div>');
await page.locator("div").screenshot({ path: photoPath });

// Automatic messages start switched off (so clients don't get doubles while the old app runs).
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/settings/messages`);
await page.getByRole("button", { name: "Turn automatic messages on" }).click();
await page.getByRole("button", { name: "Turn automatic messages off" }).waitFor();
step("owner switched automatic messages on");

const day = await requestVisit({ pet: "Luna", size: "Small", zip: "94401", city: "San Mateo", phone: "(650) 555-0177", photo: photoPath });
await shot("S38-book-sent");
step(`client requested a Small bath on ${day}`);

// A ZIP ~40 miles away must not be offered that same day (25-mile rule).
const farDays = await requestVisit({ pet: "Max", size: "Small", zip: "95060", city: "Santa Cruz", phone: "(831) 555-0100", pickDay: null });
if (farDays.includes(day)) fail(`Santa Cruz was offered ${day}, which already has a San Mateo stop`);
step("a stop 40 miles away is not offered that day");

await page.goto(`${BASE}/today`);
await page.getByRole("link", { name: /booking request/ }).click();
await page.getByText("Ana Silva").waitFor();
await shot("S08-requests");
await page.getByRole("button", { name: "Accept" }).click();
await page.getByText("No requests waiting").waitFor();
step("owner accepted the request");
await page.goto(`${BASE}/clients?q=Ana`);
await page.getByText("Ana Silva").click();
await page.getByAltText("Photo of Luna").waitFor();
step("Luna's photo from the booking page shows on the client profile");

await page.goto(`${BASE}/settings/messages`);
const outboxUrl = await page.getByLabel("Link for the Shortcut").inputValue();
await page.goto(`${BASE}/settings/calendar`);
const calendarUrl = await page.getByLabel("Your calendar link (keep it private)").inputValue();
await shot("S20-messages-settings");

const first = await (await fetch(outboxUrl)).json();
// The outbox can also hold texts for other clients (e.g. from slice.mjs); look at Ana's.
const bodies = first.messages.filter((m) => m.phone === "+16505550177").map((m) => m.body);
if (bodies.length < 2) fail(`expected Ana's "request received" and "booked" texts, got ${JSON.stringify(first)}`);
if (!bodies.some((b) => b.includes("received your request"))) fail("no request-received text");
const booked = bodies.find((b) => b.includes("is booked for"));
if (!booked) fail("no booking confirmation text");
const second = await (await fetch(outboxUrl)).json();
if (second.count !== 0) fail("the outbox returned the same texts twice");
step(`iPhone outbox returned Ana's ${bodies.length} texts, and only once`);

const link = booked.match(/https?:\/\/\S+\/a\/[0-9a-f]+/)?.[0];
if (!link) fail("no confirm link in the text");
const client = await ctx.newPage();
await client.goto(link);
await client.getByRole("button", { name: "Confirm my appointment" }).click();
await client.getByText("Confirmed. See you then!").waitFor();
await client.screenshot({ path: `${SHOTS}/A-client-confirmed.png`, fullPage: true });
step("client confirmed from the link in the text");

// The client asks for a different time; the owner sees it in Requests.
await client.getByText("I need a different time").click();
await client.locator('textarea[name="note"]').fill("Any morning next week");
await client.getByRole("button", { name: "Ask for a new time" }).click();
await client.getByText("We got your request for a different time").waitFor();
await page.goto(`${BASE}/requests`);
await page.getByText('"Any morning next week"').waitFor();
step("client asked for a different time and it shows in Requests");

const ics = await (await fetch(calendarUrl)).text();
if (!ics.includes("BEGIN:VEVENT") || !ics.includes("Luna")) fail("calendar feed is missing the visit");
const bad = await fetch(calendarUrl.replace(/key=\w+/, "key=" + "0".repeat(48)));
if (bad.status !== 401) fail("calendar feed answered a wrong key");
step("calendar feed lists the visit and refuses a wrong key");

// A returning client only types the phone: pets and address come from the file.
await page.goto(`${BASE}/book`);
await page.getByLabel("Mobile phone").fill("650-555-0177");
await button("Next").click();
await page.getByText("Welcome back, Ana!").waitFor();
await page.getByText("in San Mateo").waitFor();
if (await page.getByLabel("Street address").count()) fail("returning client was asked for the address again");
await button("Continue").click();
// Luna is her only pet, so she is already picked.
if ((await page.getByRole("checkbox", { name: "Luna" }).getAttribute("aria-checked")) !== "true") fail("Luna was not preselected");
await button("Continue to service").click();
if (await page.getByRole("radiogroup", { name: "Size" }).count()) fail("returning client was asked Luna's size again");
await page.getByRole("radiogroup", { name: "Service" }).getByRole("radio").first().click();
await button("Continue").click();
await page.getByRole("radio", { name: "No", exact: true }).click();
await button("Confirm info for Luna").click();
await page.getByRole("heading", { name: "Select a time" }).waitFor();
await page.locator("button[aria-label*='open time']:not([disabled])").nth(2).click();
await page.getByRole("group", { name: "Open times" }).locator("button").first().click();
await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
if (await page.getByLabel("First name").count()) fail("returning client was asked for their name again");
if (await page.getByRole("button", { name: /Read and sign/ }).count()) fail("returning client was asked to sign again");
await shot("S31-book-returning");
await button("Submit booking request").click();
await page.getByText("Waiting for confirmation").waitFor();
step("returning client booked with just the phone: no address, name or signature asked again");

// Import a made-up export (same columns as the old app) twice: no duplicates the second time.
const { writeFileSync } = await import("node:fs");
const csvPath = `${SHOTS}/fake-export.csv`;
const header = ["First name", "Last name", "email", "Primary contact", "address", "pet(Breed)", "Last service", "Next service",
  "notes", "preferred frequency (days)", "latitude, longitude of the address"].map((h) => h + "\t");
writeFileSync(csvPath, [header.join(","),
  ['Test', 'Person', 'test@example.com', '4155550199', '"1 Elm St, San Mateo, CA, US, 94401"', '"Bo(Poodle (h)),Mo(Pug)"',
   '2026-09-01 09:00-11:00', '2027-01-05 09:00-11:00', 'Likes treats', '28', '"37.56, -122.32"'].join(",")].join("\n"));
for (const expected of ["1 clients and 2 pets imported, 1 upcoming visits.", "0 clients and 0 pets imported"]) {
  await page.goto(`${BASE}/settings/import`);
  await page.setInputFiles('input[type="file"]', csvPath);
  await page.getByRole("button", { name: "Import clients" }).click();
  await page.getByText(expected).waitFor();
}
await page.goto(`${BASE}/clients?q=Test`);
await page.getByText("Bo, Mo").waitFor();
step("CSV import: client, 2 pets and the next visit; second import adds nothing");

// Export: a CSV in the importer's own columns, with the clients and their pets.
const exported = await (await page.request.get(`${BASE}/api/export/clients`)).text();
if (!exported.includes("Primary contact") || !exported.includes("Luna(Maltese)") || !exported.includes("Bo(Poodle (h)),Mo(Pug)")) {
  fail("export is missing columns or pets");
}
const exportPath = `${SHOTS}/export.csv`;
writeFileSync(exportPath, exported);
await page.goto(`${BASE}/settings/import`);
await page.setInputFiles('input[type="file"]', exportPath);
await page.getByRole("button", { name: "Import clients" }).click();
await page.getByText("0 clients and 0 pets imported").waitFor();
step("export downloads every client with pets, and importing it back adds nothing");

// Breed suggestions on the owner's pet form.
await page.goto(`${BASE}/clients?q=Ana`);
await page.getByText("Ana Silva").click();
await page.getByRole("link", { name: "Add pet" }).click();
await page.waitForURL(/\/pets\/new/);
await page.locator("#dog-breeds option").first().waitFor({ state: "attached" });
const breeds = await page.locator("#dog-breeds option").count();
if (breeds < 300) fail(`expected the breed list, got ${breeds} options`);
step(`breed suggestions loaded (${breeds} breeds)`);

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("All good.");
