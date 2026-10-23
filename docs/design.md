# Gold Cleaning App — design

Date: 2026-10-23 · Status: approved by the owners (2026-10-23)

## Intent and why

Peninsula Gold Cleaning (Amanda, one cleaning team, San Mateo to Cupertino) gets bookings today
through a quote form on the website, then handles everything by hand. The owners want what a
BookingKoala-style system gives competitors like Clover Cleaning: **the client sees the price
up front and books online, and the business runs everything from its own app on the iPhone**.

They already built this for their other business, Woofers Dog Spa (`Steffanobreno/Duperpower`,
branch `production`, running on Netlify + Neon). This project is a **separate app for the
cleaning business, built from that base**, so the proven parts (calendar, requests, abandoned
booking recovery, Gmail, Google Calendar, reports, backups, push notifications) are reused
instead of rebuilt.

## Goals

1. **Online booking with the price shown live** (Clover flow), embedded in
   peninsulagoldcleaning.com at `/book-now`.
2. **Owner app on Amanda's iPhone** (installable web app, like Woofers), built for cleaning:
   - requests to approve or decline;
   - calendar with day, week, month and **year** views;
   - clients and their homes;
   - recurring cleanings;
   - checkout and payments;
   - financial reports;
   - abandoned booking recovery;
   - the day's homes on a map, with distances.
3. **All client communication by email** from the business Gmail (`bayareacserv@gmail.com`).
4. **Google Calendar sync** with the business Google account.
5. **Zero monthly cost**, like Woofers: Netlify Free, Neon Free and Gmail.

## Non-goals

- **No SMS automation.** No Twilio and no iPhone Shortcuts outbox. Clients who want to talk call
  or text the Google Voice number (650) 434-2080 by hand.
- **No online payment,** no card on file, no tips, coupons or gift cards at booking. Payments
  are recorded in the app (Cash, Zelle, Venmo, check, card taken in person).
- **Not a multi-business platform.** One business, one app.
- **No pets, vaccines, grooming reports or van route optimization** (Woofers-only features).

## Anti-goals (would be a failure even if it works)

- The client is charged, or told a booking is confirmed, before Amanda approves it.
- The website gets noticeably slower, or loses its Lighthouse 98–100 scores, on any page other
  than `/book-now`.
- Amanda's private phone number appears anywhere.
- Changing a price later changes what past clients were quoted. Prices are copied onto each
  booking, as Woofers already does.

## Constraints

- **One team, two fixed slots a day:** a **morning slot starting 9:00** and an **afternoon
  slot starting 13:00**, each 3 hours (4 for homes with more than 3 bedrooms). One cleaning per slot, so at
  most two clients a day. Working days are Monday to Friday, as on the website. Slots and days
  are editable in Settings.
- **Approval:** every online booking is a **request**. It holds its time slot until Amanda
  accepts (the client gets a confirmation email) or declines (the client gets an email with
  other options).
- **Service area:** the 14 primary cities (San Mateo, Foster City, Belmont, San Carlos, Redwood
  City, Atherton, Menlo Park, Portola Valley, Woodside, Palo Alto, Los Altos, Mountain View,
  Sunnyvale, Cupertino) plus the 14 on-request cities listed on the website. Since every booking
  is approved by hand, all 28 cities can book. Outside them, the client is asked to call or text.
- **Timezone and money:** America/Los_Angeles; amounts in cents (USD).
- **Separate accounts:** the owners create **new Netlify and Neon accounts** for Gold Cleaning,
  so nothing is shared with Woofers (credits, database, access). Same production-branch-only
  setup as Woofers (about 4 deploys a month, about 100 of the 300 free credits).

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Copy the Woofers app into a new repo and adapt it for cleaning | Fastest path to a complete system; the features are already proven in daily use. Two similar codebases: a fix in one does not reach the other by itself. |
| B | Build booking and an admin area inside the Lovable website (Vite + Supabase) | One place, but everything Woofers already does would be rebuilt; the site is a fast marketing site, not an app, and Lovable can overwrite the work. |
| C | Subscribe to BookingKoala | Ready in hours, but a monthly fee, generic look, slows the site's booking page, and the owners don't own it. |

The owners chose **A** ("two distinct apps, reuse the base").

## What gets built

### 1. Client booking page (`/book` in the app, shown inside the website's `/book-now`)

A single scrolling page in Clover's order, with a **sticky price summary** at the bottom that
updates on every choice and expands to show the line items.

1. **Service:** Regular Clean, Deep Clean, Move In/Out Clean (priced online), and Airbnb
   Turnover and Office Cleaning (**quote request**, see below).
   Above it sits a short "About our flat-rate prices" note: the price assumes average condition,
   heavy buildup needs a Deep Clean, and the final price is confirmed after review.
2. **Frequency:** One-time, Weekly, Every 2 weeks, Every 4 weeks, each showing its starting
   price. Only for Regular.
3. **Your home:** bedrooms (0–7, 0 = studio), full bathrooms (1–7), half bathrooms (0–7).
4. **Extras:** a grid with icons (see the extras table in section 3). Tapping an on/off extra
   selects it; tapping a per-unit extra shows − / count / + buttons. Above the grid: "If you
   choose inside cabinets, fridge or oven, please empty them before our team arrives."
5. **Contact:** first and last name, email, mobile phone. The phone is the client identity, as in
   Woofers: a returning client's name and saved home are recognized. Asked **before the date** so
   an abandoned booking can be recovered (see 2.6).
6. **Date and time:** a month calendar showing the days with a free slot, then **Morning
   (9 AM–12 PM)** or **Afternoon (1 PM–4 PM)**. Booked slots, pending requests, time off and the
   minimum notice are excluded.
7. **Address:** street, apartment, city and ZIP. The ZIP is checked against the service area.
8. **Access and notes:** "Someone will be home", "I'll leave a key / lockbox (code)", or
   "Door / gate code", plus parking notes, pets in the home, and free-text notes for the team.
9. **Review and send:** the summary, a line saying "this is a request, we'll confirm by email
   within 24 hours", and **Request booking**.

**Airbnb Turnover and Office Cleaning: quote request.** Every host and office is different, so
there is no online price. Choosing one of them replaces the rest of the page with a short form:
- name, email, phone and city/ZIP;
- type of place: Airbnb/short-term rental or office;
- size (bedrooms/baths, or square feet and rooms for an office);
- how often they need it;
- a message box ("Tell us what you need");
- optional photos.

Sending it creates a **quote request** in the owner app, emails the owner, and sends the client
a "we'll get back to you" email. Amanda replies by email or text and arranges a visit if needed;
she can then create the client and the booking at the agreed price.

**After sending:** a thank-you screen, a "request received" email to the client, and an email
plus push notification to the owner.

**Website embed:** `/book-now` on the website shows the app's `/book?embed=1` (header and footer
hidden), like woofersdogspa.com/booking. Every "Free Estimate / Book Now" button on the site
already goes to `/book-now`. The old quote form and the Supabase `submit-estimate` function stay
deployed but unused until the new flow is proven, then they are removed.

### 2. Owner app

Adapted from Woofers screen by screen.

1. **Requests:** two tabs. **Bookings:** new online requests with the home, service, frequency, price breakdown and
   access notes. Accept, decline, or change the time and then accept. Accepting a recurring
   request creates the series. **Quotes:** Airbnb and Office quote requests, with Reply by
   email, Call, "Convert to client and booking" (at a price she types), and Archive.
2. **Calendar:**
   - Day, Week and Month views, as in Woofers.
   - **New Year view:** 12 mini-months, with each day colored by how full it is (free, one slot
     booked, full); tapping a day opens it.
   - Blocking time off (vacation, holidays) as in Woofers.
3. **Today:** the day's cleanings in order on a map (Leaflet + ZIP centroids, as in Woofers),
   the straight-line distance between consecutive homes, and a **Directions** button that opens
   Google Maps.
4. **Appointment:** client, home details, access info, service, extras and price; status
   (requested, confirmed, in progress, completed, cancelled, no-show); reschedule (this one or
   the whole series); checkout.
5. **Checkout:** line items copied from the booking, an adjustment line (extra time, discount),
   and payment recorded by method: Cash, Zelle, Venmo, check, card. Tips are recorded if given.
6. **Clients:** list and search; a client with one or more **homes**. Each home has address,
   bedrooms, full and half baths, access method and codes, parking, pets in the home, product
   preferences and notes. Visit history and total spent.
7. **Recurring:** weekly, every other week, every 4 weeks, using the Woofers series and repeat
   logic. Each visit's price is copied when it is created.
8. **Abandoned bookings:** anyone who left after entering contact details. Shows what they chose
   (service, home size, extras, price, date if picked). Buttons: **Email** (sends the "finish
   your booking" email), **Call** (opens the phone dialer, so the call can be placed from Google
   Voice), and **Dismiss**. Statuses New, Contacted and Recovered, as in Woofers. An automatic
   "finish your booking" email goes out 2 hours after they stop, once.
9. **Reports:**
   - revenue collected and expected by day, week or month;
   - revenue by service;
   - number of cleanings;
   - recurring clients and their monthly value;
   - top clients;
   - average ticket;
   - cancellations and no-shows.
10. **Settings:**
    - business details, logo and colors;
    - working days, the daily slots (start times) and the 3 h / 4 h duration rule;
    - booking window and minimum notice;
    - **price list** (see 3): the service × frequency table and the extras;
    - email templates and the automatic-emails switch;
    - Google Calendar script, backups and push notifications;
    - client import from CSV (if Amanda has a list).

### 3. Pricing model (flat rate, from the owners' price list, editable in Settings)

Each **service + frequency** combination has its own row. The price starts at **1 bedroom /
1 bathroom**; each additional room adds a flat amount:

`price = start + (bedrooms − 1) × per_bedroom + (full_baths − 1) × per_full_bath + half_baths × per_half_bath`

| Service | Frequency | Start (1 bed / 1 bath) | + bedroom | + full bath | + half bath |
|---|---|---|---|---|---|
| Regular | One-time | $191.00 | $25.00 | $42.00 | $15.00 |
| Regular | Weekly | $152.80 | $20.00 | $33.60 | $12.00 |
| Regular | Every 2 weeks ("every other week") | $163.00 | $20.00 | $33.60 | $12.00 |
| Regular | Every 4 weeks | $183.00 | $20.00 | $33.60 | $12.00 |
| Deep Clean | One-time | $331.00 | $25.00 | $42.00 | $15.00 |
| Move In/Out | One-time | $331.00 | $25.00 | $42.00 | $15.00 |

- Half bath: owners agreed to $15 one-time and $12 recurring (matches Clover). Applying $15 to
  Deep and Move In/Out, and $12 to every recurring frequency, is my call.
- Check: Regular one-time, 3 bed / 2 bath / 1 half = $191 + 2×25 + 42 + 15 = **$298.00**;
  weekly = $152.80 + 2×20 + 33.60 + 12 = **$238.40**.
- Deep Clean and Move In/Out are one-time only.
- A studio (0 bedrooms) is priced as 1 bedroom (my call).
- Extras are flat prices added on top, the same for every service and frequency:

| Extra | Price | How it's chosen |
|---|---|---|
| Inside Cabinets | $65 | on/off |
| Garage / Basement Full Interior Cleaning | $200 | per unit |
| Garage Floor | $55 | per unit |
| Inside Oven | $40 | per unit |
| Inside Fridge | $45 | per unit |
| Baseboards | $50 | on/off |
| Balcony / Patio | $75 | per unit |
| Outside Accessible Window / Balcony Door | $17 | per unit |
| Inside Windows | $50 | on/off |
| Linens & Towels | $45 | per unit |
| Handwash Dishes | $40 | on/off |
| Additional Inside Window | $10 | per unit |
| Wet Wipe Window Blinds | $15 | per unit |

  (The owners sent these from Clover's booking page as the list to use.)
- Airbnb Turnover and Office Cleaning have no online price (quote request; owners' decision).

The breakdown (start, each room line, extras) is copied onto the booking.

**Duration:** 3 hours; **4 hours for homes with more than 3 bedrooms** (owners' rule). The
slots still start at 9:00 and 13:00: a large home in the morning runs 9:00–13:00 (the
afternoon client keeps 13:00), and in the afternoon 13:00–17:00. The owners call clients if a
day needs adjusting.

### 4. Email (Gmail app password, as in Woofers)

Emails go out from the business Gmail with the Gold logo and a "See my appointment" link to a
page where the client can confirm or cancel.

| Email | Who gets it | When |
|---|---|---|
| Request received | client | right away |
| New request | owner | right away |
| Quote request received | client | right away |
| New quote request | owner | right away |
| Accepted / confirmed | client | when Amanda accepts |
| Declined (with options) | client | when Amanda declines |
| Reminder | client | the day before, at 10:00 |
| Rescheduled / cancelled | client | when either happens |
| Thank you + Google review link (`https://g.page/r/CX5Xbuztgx9cEAE/review`) | client | 2 hours after checkout |
| Finish your booking | client | 2 hours after an abandoned booking, once |

Automatic emails start **off**, as in Woofers, and Amanda turns them on when she is ready.

### 5. Hosting and setup (same as the Woofers guide, `docs/guia-configuracao.md`)

| Piece | What |
|---|---|
| Code | new private repo `Steffanobreno/goldcleaning-app`, copied from Duperpower `production` |
| Database | **new Neon account** (Free), project `goldcleaning-app` in AWS US East 2 (Ohio), the same region as Netlify Functions; Postgres only |
| Hosting | **new Netlify account** (Free), production branch `production`, branch deploys off |
| Environment | `DATABASE_URL`, `APP_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET` |
| Domain | `app.peninsulagoldcleaning.com` (CNAME), or the netlify.app address at first |
| iPhone | Safari → Add to Home Screen, then turn on notifications |

## Changes to the Woofers base

- **Replace the slot finder:** Woofers builds start times on a grid around visits and driving
  buffers; here a day has a list of named slots (start, end, label), and a slot is free when no
  active booking or request holds it.
- **Remove:** pets, pet photos, breeds, vaccines, grooming reports, pet codes, size and weight
  prices, the SMS outbox, iPhone Shortcuts setup, SMS templates, the route buffer and cluster
  rules (one team, two fixed slots a day).
- **Rename and reshape:** `pets` become `homes`; appointment pets and services become one home
  plus one service plus extras, with the price breakdown.
- **Keep as is:** auth, sessions and login limits; working hours and time off; requests and
  approval; booking drafts and abandoned recovery; series and repeat; invoices and payments;
  reports; Gmail email and templates; ICS and the Google Calendar script; push notifications;
  backups; CSV import (adapted columns); marketing email campaigns.
- **New:** the Clover-style booking page with live price, the pricing model and its settings,
  and the Year view.
- **Brand:** navy `#0B1F3B` and gold `#C6A45E`, the Gold Cleaning logo, and English UI, as in
  Woofers.

## Decided by the owners

- One app for the cleaning business only, built from the Woofers base, on Netlify + Neon.
- One team; two clients a day, starting 9:00 and 13:00; 3 hours each, 4 hours for homes with
  more than 3 bedrooms.
- Every online booking waits for Amanda's approval.
- Communication by email; calls and texts go through Google Voice by hand.
- Prices: the owners' table for Regular, Deep and Move In/Out; the half bath is $15 one-time and
  $12 recurring; the extras use the Clover list.
- Airbnb Turnover and Office Cleaning are quote requests, never priced online.
- Required owner features: full calendar (day, week, month, year), financial reports, booking
  requests, abandoned booking recovery, map and distance, Google Calendar, Gmail.

## My calls (owners can override)

- Working days Monday to Friday (from the website); editable.
- Minimum notice 24 hours; booking opens 60 days ahead.
- Contact details are asked before the date, so abandoned bookings can be recovered.
- All 28 website cities can book online; the primary/on-request split stays on the website only.
- The client confirm/cancel page has no client login (a link with a token, as in Woofers).
- The service agreement / signature feature is kept but **off**.
- Marketing email campaigns are kept, since they cost nothing.
- The Woofers 2-hour delay for the abandoned-booking email is kept.

## Left to the builder

The database migration strategy (a fresh schema from the Woofers migrations, renamed), the
component structure, the tests (port the Woofers e2e booking test to the new flow), and the
placement and labels of the year-view legend.
