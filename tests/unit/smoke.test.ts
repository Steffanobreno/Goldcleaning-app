import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "../../src/lib/format";

test("normalizes a US phone number to E.164", () => {
  assert.equal(normalizePhone("(650) 434-2080"), "+16504342080");
});
