import { test } from "node:test";
import assert from "node:assert/strict";
import { openSlots, type Busy, type SlotDef } from "../../src/lib/slots";
import { zonedToUtc } from "../../src/lib/format";

const TZ = "America/Los_Angeles";
// Monday to Friday, 9 AM and 1 PM.
const SLOTS: SlotDef[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start: "09:00", label: "Morning" },
  { weekday, start: "13:00", label: "Afternoon" },
]);
const at = (date: string, time: string) => zonedToUtc(date, time, TZ);
const busy = (date: string, from: string, to: string): Busy => ({ start: at(date, from), end: at(date, to) });
const LONG_AGO = new Date("2020-01-01T00:00:00Z");

function day(firstDay: string, opts: { durationMin?: number; busy?: Busy[]; earliest?: Date; days?: number } = {}) {
  return openSlots({
    firstDay,
    days: opts.days ?? 1,
    tz: TZ,
    slots: SLOTS,
    durationMin: opts.durationMin ?? 180,
    busy: opts.busy ?? [],
    earliest: opts.earliest ?? LONG_AGO,
  });
}

test('empty Monday 2026-11-09 offers 09:00 and 13:00, labeled "Morning" and "Afternoon"', () => {
  const [d] = day("2026-11-09");
  assert.equal(d.date, "2026-11-09");
  assert.deepEqual(
    d.times.map((t) => [t.value, t.slotLabel]),
    [
      [at("2026-11-09", "09:00").toISOString(), "Morning"],
      [at("2026-11-09", "13:00").toISOString(), "Afternoon"],
    ],
  );
});

test("a booking 09:00–12:00 leaves only 13:00", () => {
  const [d] = day("2026-11-09", { busy: [busy("2026-11-09", "09:00", "12:00")] });
  assert.deepEqual(d.times.map((t) => t.slotLabel), ["Afternoon"]);
});

test("large home: 240 minutes still offers both slots", () => {
  const [d] = day("2026-11-09", { durationMin: 240 });
  assert.deepEqual(d.times.map((t) => t.slotLabel), ["Morning", "Afternoon"]);
});

test("a large home booked 09:00–13:00 keeps the 13:00 slot open", () => {
  const [d] = day("2026-11-09", { busy: [busy("2026-11-09", "09:00", "13:00")] });
  assert.deepEqual(d.times.map((t) => t.slotLabel), ["Afternoon"]);
});

test("time off covering the day offers nothing, and the day is omitted", () => {
  assert.deepEqual(day("2026-11-09", { busy: [busy("2026-11-09", "00:00", "23:59")] }), []);
});

test("Saturday and Sunday offer nothing", () => {
  assert.deepEqual(day("2026-11-07", { days: 2 }), []);
});

test("earliest = Mon 10:00 local hides Monday 09:00 and keeps Monday 13:00", () => {
  const [d] = day("2026-11-09", { earliest: at("2026-11-09", "10:00") });
  assert.deepEqual(d.times.map((t) => t.slotLabel), ["Afternoon"]);
});

test("DST: 2026-11-02 09:00 local is 17:00Z; 2027-03-15 09:00 local is 16:00Z (DST starts Mar 14, 2027)", () => {
  assert.equal(day("2026-11-02")[0].times[0].value, "2026-11-02T17:00:00.000Z");
  assert.equal(day("2027-03-15")[0].times[0].value, "2027-03-15T16:00:00.000Z");
});

test("a week from Monday lists five weekdays", () => {
  assert.deepEqual(
    day("2026-11-09", { days: 7 }).map((d) => d.date),
    ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"],
  );
});
