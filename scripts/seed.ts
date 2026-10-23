// Creates the Woofers Dog Spa business with its services, hours and SMS texts.
// Safe to run more than once: it does nothing if a business already exists.
// Usage: npm run db:seed
import postgres from "postgres";
import { dbConfig } from "../src/lib/db-config";
import { AGREEMENT_BODY, AGREEMENT_TITLE } from "./agreement";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = dbConfig(url);
const sql = postgres(db.url, { max: 1, prepare: db.prepare, onnotice: () => {} });

type Size = "small" | "medium" | "large" | "xlarge";
const SIZE_LABEL: Record<Size, string> = {
  small: 'Small (12" or less)',
  medium: 'Medium (12"-16")',
  large: 'Large (16"-20")',
  xlarge: 'X-Large (20" or up)',
};

const haircut: [Size, number, number][] = [
  ["small", 120, 12900],
  ["medium", 120, 14900],
  ["large", 120, 17900],
  ["xlarge", 180, 19900],
];
const bath: [Size, number, number][] = [
  ["small", 120, 9900],
  ["medium", 120, 10900],
  ["large", 120, 12900],
  ["xlarge", 120, 14900],
];
const addons: [string, number, number][] = [
  ["Nail trim (included in every package)", 0, 0],
  ["Dematting or shave-down fee", 0, 4500],
  ["De-shedding", 0, 4500],
  ["Nail painting", 0, 1500],
  ["Sensitive care shampoo", 0, 2000],
  ["Flea treatment bath", 0, 2000],
  ["Hypoallergenic fragrance-free shampoo", 0, 1500],
  ["Skunk odor removal", 180, 28000],
];

// The owner's own message texts. Variables in {braces} are filled in when sending.
// {link} is the client's page to see, confirm or cancel the visit (no login needed).
const templates = [
  {
    trigger: "booked",
    email_subject: "Your appointment with {business}",
    body: "From {business}, {client}, your appointment is booked for {date} at {time}. See or change it here: {link}",
  },
  {
    trigger: "request_received",
    email_subject: "We got your booking request",
    body: "Hi {client}! {business} received your request for {date} at {time}. We'll text you as soon as it's confirmed.",
  },
  {
    trigger: "request_declined",
    email_subject: "About your booking request",
    body: "Hi {client}, sorry, we can't make {date} at {time} work. Please pick another time at {booking_url} or text us at {business_phone}.",
  },
  {
    trigger: "reminder",
    offset_days: 2,
    send_at_time: "10:00",
    only_if_unconfirmed: true,
    email_subject: "Reminder: your appointment on {date}",
    body: "From {business}, {client}, your next appointment is coming up on {date} at {time}. Please confirm or cancel here: {link}",
  },
  {
    trigger: "confirmed",
    email_subject: "Appointment confirmed",
    body: "Thank you, {client}! Your appointment on {date} at {time} is confirmed. See you then! 🐾",
  },
  {
    trigger: "cancelled",
    email_subject: "Appointment cancelled",
    body: "{client}, your appointment on {date} at {time} has been cancelled. Book again anytime at {booking_url} or text us at {business_phone}.",
  },
  {
    trigger: "on_my_way",
    body: "Hi {client}! {business} is on the way to you now 🚐",
  },
  {
    trigger: "rebook",
    send_at_time: "10:00",
    email_subject: "Time for {pet}'s next groom?",
    body: "From {business}, Hello {client}, it has been almost {days} days since {pet}'s last service. Would you like to book a new appointment? Book online: {booking_url} or text us {business_phone}",
  },
  {
    trigger: "abandoned_booking",
    offset_minutes: 120,
    email_subject: "Finish booking {pet}'s spa day?",
    body: "Hi {client}! Looks like you didn't get to finish booking {pet}'s visit with {business}. Pick a time here: {booking_url} or text us at {business_phone} and we'll book it for you. 🐾",
  },
  {
    trigger: "vaccine_due",
    offset_days: 30,
    send_at_time: "10:00",
    email_subject: "{pet}'s {vaccine} vaccine expires soon",
    body: "Hi {client}! Our records show {pet}'s {vaccine} vaccine expires on {expires}. When it's renewed, please text a photo of the new certificate to {business_phone}. Thank you! 🐾 {business}",
  },
  {
    trigger: "review_request",
    offset_minutes: 30,
    email_subject: "How did we do?",
    body: "Hi! 😊🐾 It was a pleasure taking care of your pet today! We hope you loved your experience with {business}. If you have a moment, your review truly means a lot to us 💙 👉 Leave your review here: {review_url} Thank you so much for your trust, and we hope to see you again soon! 🚐✨",
  },
];

async function main() {
  const [existing] = await sql`select id from businesses limit 1`;
  if (existing) {
    // Added after the first seed: make sure the service agreement exists.
    const added = await sql`
      insert into agreements (business_id, title, body)
      select ${existing.id}, ${AGREEMENT_TITLE}, ${AGREEMENT_BODY}
      where not exists (select 1 from agreements where business_id = ${existing.id})
      returning id`;
    console.log(added.length ? "added the service agreement" : "business already exists, nothing to seed");
    return sql.end();
  }

  await sql.begin(async (tx) => {
    const [biz] = await tx`
      insert into businesses (name, phone, booking_slug, start_zip, review_url, website_url, cancellation_hours, mailing_address)
      values ('Woofers Dog Spa', '+16504800599', 'woofers', '94401',
              'https://g.page/r/CQs7lH-SjO5jEAE/review', 'https://woofersdogspa.com', 48,
              '1201 Monte Diablo Ave, San Mateo, CA 94401')
      returning id`;
    // 48 hours: the cancellation notice in the service agreement.
    await tx`insert into agreements (business_id, title, body) values (${biz.id}, ${AGREEMENT_TITLE}, ${AGREEMENT_BODY})`;
    const [staff] = await tx`
      insert into staff (business_id, name, role, color)
      values (${biz.id}, 'Steffano', 'owner', '#1d6fb8')
      returning id`;

    // Monday-Saturday 7am-7pm, Sunday off.
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
               values (${staff.id}, ${weekday}, '07:00', '19:00')`;
    }

    let order = 0;
    for (const [size, min, cents] of haircut) {
      await tx`insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, sort_order)
               values (${biz.id}, ${"Full Haircut - " + SIZE_LABEL[size]}, 'service', 'Haircut + Bath', ${size}, ${min}, ${cents}, ${order++})`;
    }
    for (const [size, min, cents] of bath) {
      await tx`insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, sort_order)
               values (${biz.id}, ${"Bath - " + SIZE_LABEL[size]}, 'service', 'Bath', ${size}, ${min}, ${cents}, ${order++})`;
    }
    for (const [name, min, cents] of addons) {
      await tx`insert into services (business_id, name, kind, category, duration_min, price_cents, sort_order)
               values (${biz.id}, ${name}, 'addon', 'Add-on', ${min}, ${cents}, ${order++})`;
    }

    for (const t of templates) {
      await tx`insert into message_templates (business_id, trigger, body, email_subject, offset_days, offset_minutes,
                                             send_at_time, only_if_unconfirmed)
               values (${biz.id}, ${t.trigger}, ${t.body}, ${t.email_subject ?? null}, ${t.offset_days ?? null},
                       ${t.offset_minutes ?? null}, ${t.send_at_time ?? null}, ${t.only_if_unconfirmed ?? false})`;
    }
  });
  console.log("seeded Woofers Dog Spa");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
