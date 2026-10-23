// Backups, end to end. Run after slice.mjs (it reuses Ana Silva, the client).
// The weekly backup files: everything as JSON (no secrets) and the client list as a CSV with
// the home sizes; a wrong key is refused; Settings → Backups shows it ran.
// Usage: DATABASE_URL=... node tests/e2e/backup.mjs [baseUrl]
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.argv[2] ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/goldcleaning", { max: 1 });
const [{ key }] = await sql`select backup_key as key from businesses limit 1`;
await sql.end();
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

const data = await page.request.get(`${BASE}/api/device/backup?key=${key}&file=data`);
const json = await data.json();
if (json.format !== "goldcleaning-backup" || !json.tables.clients.length || !json.tables.homes.length || !json.tables.appointment_lines.length)
  fail("backup JSON wrong");
if ("device_key" in json.tables.businesses[0] || JSON.stringify(json).includes("password_hash")) fail("backup leaks secrets");
const csv = await (await page.request.get(`${BASE}/api/device/backup?key=${key}&file=clients`)).text();
if (!csv.includes("Ana") || !csv.includes("Bedrooms")) fail("clients CSV wrong");
if ((await page.request.get(`${BASE}/api/device/backup?key=wrong-key-wrong-key-wrong-key-123`)).status() !== 401) fail("wrong key must be refused");

await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "owner@example.com");
await page.fill('input[name="password"]', "correct horse battery");
await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
await page.goto(`${BASE}/settings/backups`);
await page.getByText(/Working\. Last backup/).waitFor();
step(`backup: ${json.counts.clients} clients, ${json.counts.homes} homes, ${json.counts.appointments} cleanings, no secrets; CSV with home sizes`);

if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
await browser.close();
console.log("All good.");
