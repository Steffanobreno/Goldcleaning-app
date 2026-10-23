// Checks a freshly migrated and seeded database against the approved price list and rules.
// Usage: node --env-file=.env.local tests/e2e/schema.mjs   (after npm run db:migrate && npm run db:seed)
import assert from "node:assert/strict";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const step = (msg) => console.log(`✓ ${msg}`);

try {
  const [biz] = await sql`select * from businesses`;
  assert.equal(biz.name, "Peninsula Gold Cleaning");
  assert.equal(biz.phone, "+16504342080");
  assert.equal(biz.email, "bayareacserv@gmail.com");
  assert.equal(biz.review_url, "https://g.page/r/CX5Xbuztgx9cEAE/review");
  assert.equal(biz.min_notice_hours, 24);
  assert.equal(biz.booking_days_ahead, 60);
  assert.equal(biz.online_requires_approval, true);
  assert.equal(biz.auto_messages_enabled, false);
  assert.equal(biz.base_duration_min, 180);
  assert.equal(biz.large_home_bedrooms, 3);
  assert.equal(biz.large_home_extra_min, 60);
  assert.equal(biz.service_cities.length, 29); // 28 website cities + Stanford
  step("business details, booking rules and service cities");

  const services = await sql`
    select name, pricing, recurring from services where kind = 'service' and active order by sort_order`;
  assert.deepEqual(
    services.map((s) => [s.name, s.pricing, s.recurring]),
    [
      ["Regular Clean", "rate", true],
      ["Deep Clean", "rate", false],
      ["Move In/Out Clean", "rate", false],
      ["Airbnb Turnover", "quote", false],
      ["Office Cleaning", "quote", false],
    ],
  );
  step("5 services: 3 priced, Airbnb and Office by quote");

  const rates = await sql`
    select s.name, r.frequency, r.start_cents, r.bedroom_cents, r.full_bath_cents, r.half_bath_cents
    from service_rates r join services s on s.id = r.service_id
    order by s.sort_order, array_position(array['one_time','weekly','biweekly','every_4_weeks'], r.frequency)`;
  assert.deepEqual(
    rates.map((r) => [r.name, r.frequency, r.start_cents, r.bedroom_cents, r.full_bath_cents, r.half_bath_cents]),
    [
      ["Regular Clean", "one_time", 19100, 2500, 4200, 1500],
      ["Regular Clean", "weekly", 15280, 2000, 3360, 1200],
      ["Regular Clean", "biweekly", 16300, 2000, 3360, 1200],
      ["Regular Clean", "every_4_weeks", 18300, 2000, 3360, 1200],
      ["Deep Clean", "one_time", 33100, 2500, 4200, 1500],
      ["Move In/Out Clean", "one_time", 33100, 2500, 4200, 1500],
    ],
  );
  step("6 rates match the owners' price list");

  const extras = await sql`select name, price_cents, per_unit from services where kind = 'extra' order by sort_order`;
  assert.deepEqual(
    extras.map((e) => [e.name, e.price_cents, e.per_unit]),
    [
      ["Inside Cabinets", 6500, false],
      ["Garage/Basement Full Interior Cleaning", 20000, true],
      ["Garage Floor", 5500, true],
      ["Inside Oven", 4000, true],
      ["Inside Fridge", 4500, true],
      ["Baseboards", 5000, false],
      ["Balcony / Patio", 7500, true],
      ["Outside Accessible Window / Balcony Door", 1700, true],
      ["Inside Windows", 5000, false],
      ["Linens & Towels", 4500, true],
      ["Handwash Dishes", 4000, false],
      ["Additional Inside Window", 1000, true],
      ["Wet Wipe Window Blinds", 1500, true],
    ],
  );
  step("13 extras with prices and per-unit flags");

  const slots = await sql`select weekday, to_char(start_time, 'HH24:MI') as start, label from booking_slots order by weekday, start_time`;
  assert.equal(slots.length, 10);
  assert.deepEqual([...new Set(slots.map((s) => s.weekday))], [1, 2, 3, 4, 5]);
  assert.deepEqual([...new Set(slots.map((s) => `${s.start} ${s.label}`))], ["09:00 Morning", "13:00 Afternoon"]);
  step("booking slots: Monday–Friday, 9:00 Morning and 13:00 Afternoon");

  const tables = (await sql`select table_name from information_schema.tables where table_schema = 'public'`).map((t) => t.table_name);
  for (const t of ["homes", "appointment_homes", "appointment_lines", "service_rates", "booking_slots", "quote_requests", "quote_request_photos"]) {
    assert.ok(tables.includes(t), `missing table ${t}`);
  }
  for (const t of ["pets", "vaccines", "pet_photos", "pet_codes", "grooming_reports", "route_rules", "service_areas", "service_prices"]) {
    assert.ok(!tables.includes(t), `table ${t} should be gone`);
  }
  step("cleaning tables exist; grooming tables are gone");

  const [staff] = await sql`select name, role from staff`;
  assert.deepEqual([staff.name, staff.role], ["Amanda", "owner"]);
  const [agreement] = await sql`select required_online from agreements`;
  assert.equal(agreement?.required_online ?? false, false);
  const triggers = (await sql`select trigger from message_templates order by trigger`).map((t) => t.trigger);
  for (const t of ["request_received", "request_accepted", "request_declined", "reminder", "cancelled", "review_request", "abandoned_booking", "quote_received", "quote_new"]) {
    assert.ok(triggers.includes(t), `missing email template ${t}`);
  }
  step("owner, agreement off, email templates");
  console.log("All good.");
} finally {
  await sql.end();
}
