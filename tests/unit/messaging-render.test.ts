import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "../../src/lib/messaging-render";

const vars = {
  client: "Ana",
  business: "Peninsula Gold Cleaning",
  date: "Tue, Oct 27",
  time: "9:00 AM",
  service: "Regular Clean",
  home: "3 bd / 2 ba",
  total: "$278.40",
  appointment_url: "https://app.example/a/abc",
  booking_url: "https://app.example/book",
  review_url: "https://g.page/r/x/review",
  business_phone: "(650) 434-2080",
};

test("every variable is filled in", () => {
  const body =
    "{client} {business} {date} {time} {service} {home} {total} {appointment_url} {booking_url} {review_url} {business_phone}";
  assert.equal(
    renderTemplate(body, vars),
    "Ana Peninsula Gold Cleaning Tue, Oct 27 9:00 AM Regular Clean 3 bd / 2 ba $278.40 https://app.example/a/abc " +
      "https://app.example/book https://g.page/r/x/review (650) 434-2080",
  );
});

test("{link} is the appointment page too", () => {
  assert.equal(renderTemplate("See it: {link}", vars), "See it: https://app.example/a/abc");
  assert.equal(renderTemplate("{appointment_url}", { link: "https://x/a/1" }), "https://x/a/1");
});

test("an unknown {x} stays as is, and a missing value keeps its braces", () => {
  assert.equal(renderTemplate("Hi {client}, {x}!", vars), "Hi Ana, {x}!");
  assert.equal(renderTemplate("{review_url}", { review_url: null }), "{review_url}");
});
