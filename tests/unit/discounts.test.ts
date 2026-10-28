import { test } from "node:test";
import assert from "node:assert/strict";
import { discountCents, priceLines, totalCents, withDiscounts, type DiscountDef } from "../../src/lib/pricing";

const rate = { startCents: 19100, bedroomCents: 2500, fullBathCents: 4200, halfBathCents: 1500 };
const lines = priceLines({ id: "svc", name: "Regular Clean" }, "one_time", rate, { bedrooms: 3, fullBaths: 2, halfBaths: 1 }, []); // 29800
const pct = (percent: number): DiscountDef => ({ id: "p", name: `${percent}% off`, kind: "percent", percent, amountCents: null });
const amt = (cents: number): DiscountDef => ({ id: "a", name: "Welcome", kind: "amount", percent: null, amountCents: cents });

test("a percent discount rounds to cents and an amount is taken as is", () => {
  assert.equal(discountCents(pct(10), 29800), 2980);
  assert.equal(discountCents(pct(15), 19100), 2865);
  assert.equal(discountCents(amt(2500), 29800), 2500);
});

test("a discount never takes off more than the price", () => {
  assert.equal(discountCents(amt(50000), 29800), 29800);
  assert.equal(discountCents(pct(100), 29800), 29800);
});

test("a home's standing adjustment lowers or raises every visit", () => {
  assert.equal(totalCents(withDiscounts(lines, { adjustCents: -2000 })), 27800);
  assert.equal(totalCents(withDiscounts(lines, { adjustCents: 1500 })), 31300);
  const [adj] = withDiscounts(lines, { adjustCents: -2000, adjustNote: "Loyalty rate" }).filter((l) => l.kind === "rate");
  assert.equal(adj.label, "Loyalty rate");
  assert.equal(withDiscounts(lines, { adjustCents: -2000 }).find((l) => l.kind === "rate")?.label, "Regular client rate");
});

test("percent discounts come off the cleaning price, not off each other or the adjustment", () => {
  const out = withDiscounts(lines, { adjustCents: -2000, standing: [pct(10)], coupon: pct(10) });
  // 29800 - 2000 - 2980 - 2980 = 21840
  assert.equal(totalCents(out), 21840);
  assert.deepEqual(out.map((l) => l.kind), ["service", "room", "room", "room", "rate", "discount", "coupon"]);
});

test("a coupon is its own line kind, so a repeating series can leave it out", () => {
  const out = withDiscounts(lines, { coupon: amt(2500) });
  assert.equal(out.filter((l) => l.kind === "coupon").length, 1);
  assert.equal(totalCents(out), 27300);
});

test("the total never goes below zero", () => {
  assert.equal(totalCents(withDiscounts(lines, { adjustCents: -29000, standing: [amt(5000)] })), 0);
});

test("no adjustment and no discounts leave the lines unchanged", () => {
  assert.equal(withDiscounts(lines, {}).length, lines.length);
  assert.equal(withDiscounts(lines, { adjustCents: 0 }).length, lines.length);
});
