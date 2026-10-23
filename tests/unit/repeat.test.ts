import { test } from "node:test";
import assert from "node:assert/strict";
import { repeatDates, seriesForFrequency } from "../../src/lib/repeat";

test("seriesForFrequency: weekly 1, every 2 weeks 2, every 4 weeks 4, one-time none", () => {
  assert.deepEqual(seriesForFrequency("weekly"), { freq: "week", interval: 1 });
  assert.deepEqual(seriesForFrequency("biweekly"), { freq: "week", interval: 2 });
  assert.deepEqual(seriesForFrequency("every_4_weeks"), { freq: "week", interval: 4 });
  assert.equal(seriesForFrequency("one_time"), null);
});

test("every 2 weeks from Tue Nov 3 2026 for 60 days gives 5 Tuesdays", () => {
  assert.deepEqual(repeatDates("2026-11-03", { freq: "week", every: 2, count: null, until: "2027-01-02" }), [
    "2026-11-03", "2026-11-17", "2026-12-01", "2026-12-15", "2026-12-29",
  ]);
});
