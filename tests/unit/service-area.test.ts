import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceAreaProblem, OUTSIDE_AREA, UNKNOWN_ZIP } from "../../src/lib/service-area";

const CITIES = [
  "San Mateo", "Foster City", "Belmont", "San Carlos", "Redwood City", "Atherton", "Menlo Park",
  "Portola Valley", "Woodside", "Palo Alto", "Stanford", "Los Altos", "Mountain View", "Sunnyvale",
  "Cupertino", "Daly City", "South San Francisco", "San Francisco", "Brisbane", "San Bruno",
  "Millbrae", "Burlingame", "Hillsborough", "Santa Clara", "San Jose", "Milpitas", "Hayward",
  "Fremont", "Union City",
];

test("ZIPs inside the service cities are accepted", () => {
  for (const zip of ["94401", "94027", "95014", "94110", "94538"]) {
    assert.equal(serviceAreaProblem(zip, CITIES), null, zip);
  }
});

test("Foster City, Hillsborough and Woodside ZIPs are accepted (the ZIP data names a neighbor city)", () => {
  for (const zip of ["94404", "94010", "94062"]) assert.equal(serviceAreaProblem(zip, CITIES), null, zip);
});

test("Stanford is accepted", () => {
  assert.equal(serviceAreaProblem("94305", CITIES), null);
});

test("city names match regardless of letter case", () => {
  assert.equal(serviceAreaProblem("94401", ["SAN MATEO"]), null);
});

test("a ZIP outside the cities gets the outside-area message", () => {
  assert.equal(serviceAreaProblem("95060", CITIES), OUTSIDE_AREA);
});

test("an unknown ZIP gets the unknown-ZIP message", () => {
  assert.equal(serviceAreaProblem("00000", CITIES), UNKNOWN_ZIP);
  assert.equal(serviceAreaProblem("", CITIES), UNKNOWN_ZIP);
});
