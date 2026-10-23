import { test } from "node:test";
import assert from "node:assert/strict";
import { dayFill } from "../../src/lib/calendar-fill";

const TZ = "America/Los_Angeles";
// Tue Nov 3 2026: 9:00 and 13:00 local are 17:00Z and 21:00Z.
const at = (iso: string, status = "confirmed") => ({ start_at: new Date(iso), status });

test("two active cleanings on one day: full", () => {
  assert.equal(dayFill([at("2026-11-03T17:00:00Z"), at("2026-11-03T21:00:00Z", "requested")], TZ).get("2026-11-03"), 2);
});

test("one active and one cancelled: one slot taken", () => {
  assert.equal(dayFill([at("2026-11-03T17:00:00Z"), at("2026-11-03T21:00:00Z", "cancelled")], TZ).get("2026-11-03"), 1);
});

test("no cleanings, or only declined and no-show: absent", () => {
  const m = dayFill([at("2026-11-04T17:00:00Z", "declined"), at("2026-11-04T21:00:00Z", "no_show")], TZ);
  assert.equal(m.has("2026-11-04"), false);
  assert.equal(m.size, 0);
});

test("days are counted in the business time zone (8 PM local is still that day)", () => {
  // 8 PM Nov 3 local = 04:00Z Nov 4.
  assert.equal(dayFill([at("2026-11-04T04:00:00Z")], TZ).get("2026-11-03"), 1);
});
