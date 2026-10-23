import { test } from "node:test";
import assert from "node:assert/strict";
import { durationMinutes, priceLines, totalCents, type ExtraPick, type Rate } from "../../src/lib/pricing";

// The owners' price list (cents): [start, bedroom, full bath, half bath].
const rate = (start: number, bed: number, full: number, half: number): Rate => ({
  startCents: start,
  bedroomCents: bed,
  fullBathCents: full,
  halfBathCents: half,
});
const REGULAR_ONE_TIME = rate(19100, 2500, 4200, 1500);
const REGULAR_WEEKLY = rate(15280, 2000, 3360, 1200);
const DEEP_ONE_TIME = rate(33100, 2500, 4200, 1500);

const regular = { id: "svc-regular", name: "Regular Clean" };
const deep = { id: "svc-deep", name: "Deep Clean" };
const home = (bedrooms: number, fullBaths: number, halfBaths: number) => ({ bedrooms, fullBaths, halfBaths });
const extra = (serviceId: string, name: string, unitCents: number, qty = 1): ExtraPick => ({ serviceId, name, unitCents, qty });

test("regular one-time 3bd/2ba/1half totals 29800", () => {
  assert.equal(totalCents(priceLines(regular, "one_time", REGULAR_ONE_TIME, home(3, 2, 1), [])), 29800);
});

test("regular weekly 3bd/2ba/1half totals 23840", () => {
  assert.equal(totalCents(priceLines(regular, "weekly", REGULAR_WEEKLY, home(3, 2, 1), [])), 23840);
});

test("studio (0 bd) 1 ba one-time totals 19100, same as 1 bd", () => {
  assert.equal(totalCents(priceLines(regular, "one_time", REGULAR_ONE_TIME, home(0, 1, 0), [])), 19100);
  assert.equal(totalCents(priceLines(regular, "one_time", REGULAR_ONE_TIME, home(1, 1, 0), [])), 19100);
});

test("1bd/1ba has a single service line and no room lines", () => {
  const lines = priceLines(regular, "one_time", REGULAR_ONE_TIME, home(1, 1, 0), []);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], {
    kind: "service",
    serviceId: "svc-regular",
    label: "Regular Clean · One-time",
    qty: 1,
    unitCents: 19100,
    amountCents: 19100,
  });
});

test("deep clean 4bd/3ba totals 49000", () => {
  assert.equal(totalCents(priceLines(deep, "one_time", DEEP_ONE_TIME, home(4, 3, 0), [])), 49000);
});

test("extras: weekly 3/2/1 + Inside Cabinets x1 + Inside Oven x1 + Inside Fridge x1 totals 38840", () => {
  const extras = [
    extra("x-cab", "Inside Cabinets", 6500),
    extra("x-oven", "Inside Oven", 4000),
    extra("x-fridge", "Inside Fridge", 4500),
  ];
  assert.equal(totalCents(priceLines(regular, "weekly", REGULAR_WEEKLY, home(3, 2, 1), extras)), 38840);
});

test("extra with qty 0 adds no line", () => {
  const lines = priceLines(regular, "weekly", REGULAR_WEEKLY, home(1, 1, 0), [extra("x-oven", "Inside Oven", 4000, 0)]);
  assert.equal(lines.length, 1);
});

test("lines: service first, then rooms, then extras in input order", () => {
  const lines = priceLines(regular, "weekly", REGULAR_WEEKLY, home(3, 2, 1), [
    extra("x-oven", "Inside Oven", 4000, 2),
    extra("x-cab", "Inside Cabinets", 6500),
  ]);
  assert.deepEqual(
    lines.map((l) => [l.kind, l.label, l.qty, l.unitCents, l.amountCents]),
    [
      ["service", "Regular Clean · Weekly", 1, 15280, 15280],
      ["room", "Extra bedroom", 2, 2000, 4000],
      ["room", "Extra full bath", 1, 3360, 3360],
      ["room", "Half bath", 1, 1200, 1200],
      ["extra", "Inside Oven", 2, 4000, 8000],
      ["extra", "Inside Cabinets", 1, 6500, 6500],
    ],
  );
  assert.equal(lines[4].serviceId, "x-oven");
  assert.equal(lines[1].serviceId, null);
});

test("duration: 3 bd takes 180 minutes, 4 bd takes 240", () => {
  const rule = { baseMin: 180, largeHomeBedrooms: 3, largeHomeExtraMin: 60 };
  assert.equal(durationMinutes(home(3, 2, 1), rule), 180);
  assert.equal(durationMinutes(home(4, 2, 0), rule), 240);
});

// ---------------------------------------------------------------- quote() over the catalog

import { quote, type Catalog } from "../../src/lib/pricing";

const CATALOG: Catalog = {
  services: [
    {
      id: "svc-regular",
      name: "Regular Clean",
      description: null,
      pricing: "rate",
      recurring: true,
      rates: { one_time: REGULAR_ONE_TIME, weekly: REGULAR_WEEKLY },
    },
    { id: "svc-deep", name: "Deep Clean", description: null, pricing: "rate", recurring: false, rates: { one_time: DEEP_ONE_TIME } },
    { id: "svc-airbnb", name: "Airbnb Turnover", description: null, pricing: "quote", recurring: false, rates: {} },
  ],
  extras: [
    { id: "x-oven", name: "Inside Oven", unitCents: 4000, perUnit: true, icon: "oven" },
    { id: "x-cab", name: "Inside Cabinets", unitCents: 6500, perUnit: false, icon: "cabinet" },
  ],
  rule: { baseMin: 180, largeHomeBedrooms: 3, largeHomeExtraMin: 60 },
};

test("quote: weekly 3/2/1 + Inside Oven x1 = 27840, 180 minutes", () => {
  const q = quote(CATALOG, {
    serviceId: "svc-regular",
    frequency: "weekly",
    home: home(3, 2, 1),
    extras: [{ serviceId: "x-oven", qty: 1 }],
  });
  assert.ok(!("error" in q));
  assert.equal(q.totalCents, 27840);
  assert.equal(q.durationMin, 180);
});

test("quote: 4 bedrooms takes 240 minutes", () => {
  const q = quote(CATALOG, { serviceId: "svc-deep", frequency: "one_time", home: home(4, 3, 0), extras: [] });
  assert.ok(!("error" in q));
  assert.equal(q.totalCents, 49000);
  assert.equal(q.durationMin, 240);
});

test("quote: an on/off extra counts once even if asked twice", () => {
  const q = quote(CATALOG, { serviceId: "svc-regular", frequency: "one_time", home: home(1, 1, 0), extras: [{ serviceId: "x-cab", qty: 3 }] });
  assert.ok(!("error" in q));
  assert.equal(q.totalCents, 19100 + 6500);
});

test("quote: per-unit extras are capped at 20", () => {
  const q = quote(CATALOG, { serviceId: "svc-regular", frequency: "one_time", home: home(1, 1, 0), extras: [{ serviceId: "x-oven", qty: 99 }] });
  assert.ok(!("error" in q));
  assert.equal(q.totalCents, 19100 + 20 * 4000);
});

test("quote: refuses quote-only services, frequencies without a rate, and unknown ids", () => {
  const base = { frequency: "one_time" as const, home: home(1, 1, 0), extras: [] };
  assert.ok("error" in quote(CATALOG, { ...base, serviceId: "svc-airbnb" }));
  assert.ok("error" in quote(CATALOG, { ...base, serviceId: "svc-deep", frequency: "weekly" }));
  assert.ok("error" in quote(CATALOG, { ...base, serviceId: "nope" }));
  assert.ok("error" in quote(CATALOG, { ...base, serviceId: "svc-regular", extras: [{ serviceId: "nope", qty: 1 }] }));
});

test("quote: home sizes outside the form's range are refused", () => {
  const base = { serviceId: "svc-regular", frequency: "one_time" as const, extras: [] };
  assert.ok("error" in quote(CATALOG, { ...base, home: home(8, 1, 0) }));
  assert.ok("error" in quote(CATALOG, { ...base, home: home(1, 0, 0) }));
  assert.ok("error" in quote(CATALOG, { ...base, home: home(1, 1, -1) }));
  assert.ok("error" in quote(CATALOG, { ...base, home: home(1.5, 1, 0) }));
});

import { agreedQuote } from "../../src/lib/pricing";

test("agreedQuote: an Airbnb at an agreed $180 is one line, length from the home", () => {
  const q = agreedQuote(CATALOG, { serviceId: "svc-airbnb", frequency: "weekly", home: home(4, 2, 0) }, 18000);
  assert.ok(!("error" in q));
  assert.deepEqual(q.lines.map((l) => [l.kind, l.label, l.amountCents]), [["service", "Airbnb Turnover · Weekly", 18000]]);
  assert.equal(q.totalCents, 18000);
  assert.equal(q.durationMin, 240);
});

test("agreedQuote: refuses a missing or zero price and unknown services", () => {
  const base = { frequency: "one_time" as const, home: home(1, 1, 0) };
  assert.ok("error" in agreedQuote(CATALOG, { ...base, serviceId: "svc-airbnb" }, 0));
  assert.ok("error" in agreedQuote(CATALOG, { ...base, serviceId: "svc-airbnb" }, 12.5));
  assert.ok("error" in agreedQuote(CATALOG, { ...base, serviceId: "nope" }, 18000));
});
