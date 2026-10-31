// Every phrase the client pages translate with t("…") has a translation in every language,
// and no language has phrases nobody uses. Usage: node tests/i18n-check.mjs [--list]
import { readFileSync, readdirSync } from "node:fs";

const files = [
  "src/app/book/booking-page.tsx", "src/app/book/month-calendar.tsx", "src/app/book/price-summary.tsx",
  "src/app/book/extras-grid.tsx", "src/app/book/quote-form.tsx", "src/app/book/page.tsx",
  "src/app/a/[token]/page.tsx", "src/app/r/[token]/page.tsx",
  "src/components/client-shell.tsx", "src/components/receipt-view.tsx", "src/lib/i18n/index.ts",
];
const unescape = (s) => s.replace(/\\(.)/g, "$1");
const used = new Set();
for (const f of files) {
  for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) used.add(unescape(m[1]));
}
// The shapes server messages are matched to (src/lib/i18n/index.ts).
for (const m of readFileSync("src/lib/i18n/index.ts", "utf8").matchAll(/\/, "((?:[^"\\]|\\.)*)"\]/g)) used.add(unescape(m[1]));
// Names the code looks up with t(variable): frequencies, rooms, access methods, slots, quote-form choices.
for (const k of ["One-time", "Weekly", "Every 2 weeks", "Every 4 weeks", "Extra bedroom", "Extra full bath", "Half bath", "Morning", "Afternoon",
  "Between every guest", "Twice a week", "Monthly",
  "Someone will be home", "Key left for us", "Lockbox", "Door / gate code",
  "Remove the code or try another one.",
  "We couldn't find that ZIP code. Please check it, or call or text us to book.",
  "Sorry, that address is outside our service area. Call or text us and we'll see what we can do."]) used.add(k);
// English messages the booking server actions send back (shown translated on the page).
for (const f of ["src/app/book/actions.ts", "src/lib/booking.ts", "src/lib/data/discounts.ts"]) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:error: |return |CLOSED = )"((?:[^"\\]|\\.)*)"/g)) if (/[a-z]/.test(m[1]) && m[1].length > 12) used.add(unescape(m[1]));
}
if (process.argv.includes("--list")) {
  console.log([...used].sort().join("\n"));
  process.exit(0);
}

let problems = 0;
const dir = "src/lib/i18n/messages";
for (const file of readdirSync(dir).filter((f) => f !== "index.ts")) {
  const keys = new Set();
  for (const line of readFileSync(`${dir}/${file}`, "utf8").split("\n")) {
    const m = line.match(/^\s+(?:"((?:[^"\\]|\\.)*)"|([A-Za-z]\w*)):/);
    if (m) keys.add(m[1] !== undefined ? unescape(m[1]) : m[2]);
  }
  const missing = [...used].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !used.has(k));
  if (missing.length || extra.length) problems++;
  for (const k of missing) console.error(`${file}: missing "${k}"`);
  for (const k of extra) console.error(`${file}: not used "${k}"`);
}
console.log(`${used.size} phrases checked in ${readdirSync(dir).length - 1} languages`);
if (problems) process.exit(1);
console.log("All good.");
