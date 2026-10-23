// Creates Peninsula Gold Cleaning with its services, price list, extras, booking slots and
// email texts (docs/design.md). Safe to run more than once: it does nothing if a business
// already exists. Usage: npm run db:seed
import postgres from "postgres";
import { dbConfig } from "../src/lib/db-config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = dbConfig(url);
const sql = postgres(db.url, { max: 1, prepare: db.prepare, onnotice: () => {} });

// Where online bookings are accepted: the ZIP's city must be one of these. Foster City,
// Hillsborough and Woodside ZIPs show up as San Mateo, Burlingame and Redwood City in the
// ZIP data; Stanford is next to Palo Alto.
const SERVICE_CITIES = [
  "San Mateo", "Foster City", "Belmont", "San Carlos", "Redwood City", "Atherton", "Menlo Park",
  "Portola Valley", "Woodside", "Palo Alto", "Los Altos", "Mountain View", "Sunnyvale", "Cupertino",
  "Daly City", "South San Francisco", "San Francisco", "Brisbane", "San Bruno", "Millbrae",
  "Burlingame", "Hillsborough", "Santa Clara", "San Jose", "Milpitas", "Hayward", "Fremont",
  "Union City", "Stanford",
];

type Rate = [frequency: string, start: number, bedroom: number, fullBath: number, halfBath: number];
const ONE_TIME_ROOMS = [2500, 4200, 1500] as const;
const RECURRING_ROOMS = [2000, 3360, 1200] as const;

const services: { name: string; pricing: "rate" | "quote"; recurring: boolean; description: string; rates: Rate[] }[] = [
  {
    name: "Regular Clean",
    pricing: "rate",
    recurring: true,
    description: "Kitchens, bathrooms, dusting, vacuuming and mopping on your schedule.",
    rates: [
      ["one_time", 19100, ...ONE_TIME_ROOMS],
      ["weekly", 15280, ...RECURRING_ROOMS],
      ["biweekly", 16300, ...RECURRING_ROOMS],
      ["every_4_weeks", 18300, ...RECURRING_ROOMS],
    ],
  },
  {
    name: "Deep Clean",
    pricing: "rate",
    recurring: false,
    description: "Top to bottom: baseboards, grout, fixtures and built-up grime.",
    rates: [["one_time", 33100, ...ONE_TIME_ROOMS]],
  },
  {
    name: "Move In/Out Clean",
    pricing: "rate",
    recurring: false,
    description: "An empty home, cleaned inside cabinets, drawers and appliances.",
    rates: [["one_time", 33100, ...ONE_TIME_ROOMS]],
  },
  {
    name: "Airbnb Turnover",
    pricing: "quote",
    recurring: false,
    description: "Every host is different. Tell us about your place and we'll send a quote.",
    rates: [],
  },
  {
    name: "Office Cleaning",
    pricing: "quote",
    recurring: false,
    description: "Offices, studios and small businesses. Tell us what you need for a quote.",
    rates: [],
  },
];

// [name, price in cents, per unit (shows − / + buttons), icon]
const extras: [string, number, boolean, string][] = [
  ["Inside Cabinets", 6500, false, "cabinet"],
  ["Garage/Basement Full Interior Cleaning", 20000, true, "garage"],
  ["Garage Floor", 5500, true, "garage-floor"],
  ["Inside Oven", 4000, true, "oven"],
  ["Inside Fridge", 4500, true, "fridge"],
  ["Baseboards", 5000, false, "baseboard"],
  ["Balcony / Patio", 7500, true, "patio"],
  ["Outside Accessible Window / Balcony Door", 1700, true, "door"],
  ["Inside Windows", 5000, false, "window"],
  ["Linens & Towels", 4500, true, "linens"],
  ["Handwash Dishes", 4000, false, "dishes"],
  ["Additional Inside Window", 1000, true, "window"],
  ["Wet Wipe Window Blinds", 1500, true, "blinds"],
];

// Variables in {braces} are filled in when sending (src/lib/messaging.ts).
// {link} is the client's page to see, confirm or cancel the visit (no login needed).
const sign = "\n\nPeninsula Gold Cleaning · (650) 434-2080";
const templates = [
  {
    trigger: "request_received",
    email_subject: "We got your cleaning request",
    body: `Hi {client}! Thank you for choosing {business}. We received your request for {service} on {date} at {time}. We'll review it and confirm by email within 24 hours.${sign}`,
  },
  {
    trigger: "request_accepted",
    email_subject: "Your cleaning is confirmed",
    body: `Hi {client}, your {service} is confirmed for {date} at {time}. See or change it here: {link}${sign}`,
  },
  {
    trigger: "booked",
    email_subject: "Your cleaning with {business}",
    body: `Hi {client}, your {service} is booked for {date} at {time}. See or change it here: {link}${sign}`,
  },
  {
    trigger: "request_declined",
    email_subject: "About your cleaning request",
    body: `Hi {client}, we're sorry, we can't make {date} at {time} work. Please pick another time at {booking_url} or call or text us at {business_phone}.${sign}`,
  },
  {
    trigger: "reminder",
    offset_days: 1,
    send_at_time: "10:00",
    email_subject: "Reminder: your cleaning tomorrow",
    body: `Hi {client}, a reminder that your {service} is tomorrow, {date} at {time}. Need to change something? {link}${sign}`,
  },
  {
    trigger: "confirmed",
    email_subject: "Thanks for confirming",
    body: `Thank you, {client}! Your cleaning on {date} at {time} is confirmed. See you then!${sign}`,
  },
  {
    trigger: "cancelled",
    email_subject: "Your cleaning was cancelled",
    body: `Hi {client}, your cleaning on {date} at {time} has been cancelled. Book again anytime at {booking_url} or call or text us at {business_phone}.${sign}`,
  },
  {
    trigger: "review_request",
    offset_minutes: 120,
    email_subject: "How did we do?",
    body: `Hi {client}! Thank you for having us today. If you're happy with your cleaning, a quick Google review helps our small, women-led business a lot: {review_url}${sign}`,
  },
  {
    trigger: "abandoned_booking",
    offset_minutes: 120,
    email_subject: "Finish booking your cleaning?",
    body: `Hi {client}! Looks like you didn't get to finish booking your {service}. Pick a time here: {booking_url} or call or text us at {business_phone} and we'll book it for you.${sign}`,
  },
  {
    trigger: "quote_received",
    email_subject: "We got your quote request",
    body: `Hi {client}! Thank you for reaching out to {business}. We received your request and will get back to you within 24 hours with a quote, or to set up a quick visit.${sign}`,
  },
  {
    trigger: "quote_new",
    email_subject: "New quote request",
    body: "New quote request from {client}. Open the app to see the details and photos.",
  },
];

async function main() {
  const [existing] = await sql`select id from businesses limit 1`;
  if (existing) {
    console.log("business already exists, nothing to seed");
    return sql.end();
  }

  await sql.begin(async (tx) => {
    const [biz] = await tx`
      insert into businesses (name, phone, email, booking_slug, review_url, website_url, cancellation_hours,
                              booking_days_ahead, min_notice_hours, online_requires_approval, service_cities)
      values ('Peninsula Gold Cleaning', '+16504342080', 'bayareacserv@gmail.com', 'goldcleaning',
              'https://g.page/r/CX5Xbuztgx9cEAE/review', 'https://peninsulagoldcleaning.com', 24,
              60, 24, true, ${SERVICE_CITIES})
      returning id`;
    // The agreement feature stays off until the owners write one.
    await tx`insert into agreements (business_id, title, body, required_online)
             values (${biz.id}, 'Service Agreement', 'Write your service agreement here before asking clients to sign it.', false)`;
    const [staff] = await tx`
      insert into staff (business_id, name, role, color)
      values (${biz.id}, 'Amanda', 'owner', '#C6A45E')
      returning id`;

    // Monday to Friday, 9 AM to 5 PM; online start times 9:00 (Morning) and 13:00 (Afternoon).
    for (const weekday of [1, 2, 3, 4, 5]) {
      await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
               values (${staff.id}, ${weekday}, '09:00', '17:00')`;
      await tx`insert into booking_slots (business_id, weekday, start_time, label)
               values (${biz.id}, ${weekday}, '09:00', 'Morning'), (${biz.id}, ${weekday}, '13:00', 'Afternoon')`;
    }

    let order = 0;
    for (const s of services) {
      const [row] = await tx`
        insert into services (business_id, name, kind, description, duration_min, price_cents, pricing, recurring,
                              online_bookable, sort_order)
        values (${biz.id}, ${s.name}, 'service', ${s.description}, 180, 0, ${s.pricing}, ${s.recurring}, true, ${order++})
        returning id`;
      for (const [frequency, start, bedroom, fullBath, halfBath] of s.rates) {
        await tx`insert into service_rates (service_id, frequency, start_cents, bedroom_cents, full_bath_cents, half_bath_cents)
                 values (${row.id}, ${frequency}, ${start}, ${bedroom}, ${fullBath}, ${halfBath})`;
      }
    }
    for (const [name, cents, perUnit, icon] of extras) {
      await tx`insert into services (business_id, name, kind, category, duration_min, price_cents, per_unit, icon, sort_order)
               values (${biz.id}, ${name}, 'extra', 'Extras', 0, ${cents}, ${perUnit}, ${icon}, ${order++})`;
    }

    for (const t of templates) {
      await tx`insert into message_templates (business_id, trigger, body, email_subject, offset_days, offset_minutes,
                                             send_at_time)
               values (${biz.id}, ${t.trigger}, ${t.body}, ${t.email_subject ?? null}, ${t.offset_days ?? null},
                       ${t.offset_minutes ?? null}, ${t.send_at_time ?? null})`;
    }
  });
  console.log("seeded Peninsula Gold Cleaning");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
