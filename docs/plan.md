# Gold Cleaning App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A booking page with live flat-rate prices and an owner app on Amanda's iPhone for
Peninsula Gold Cleaning, built by adapting the Woofers app (Duperpower `production`).

**Architecture:** Copy Duperpower `production` into a new repo `Steffanobreno/goldcleaning-app`.
Keep its stack and patterns: Next.js App Router, server actions, postgres.js with plain SQL,
`.sql` migrations, installable PWA. One new migration reshapes the dog-grooming schema for
cleaning: pets become homes, appointment services become price lines, and per-service rates,
fixed daily slots and quote requests are added. Pricing and slot rules live in two pure modules
with unit tests. Screens are adapted one area at a time.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before writing Next code, as
`AGENTS.md` says), React 19, TypeScript, Tailwind 4, postgres.js, Postgres 16 (Neon in
production), nodemailer (Gmail), web-push, Leaflet, Playwright (e2e), `tsx --test` (unit).

**Spec:** `peninsulagoldcleaning/docs/superpowers/specs/2026-10-23-gold-cleaning-app-design.md`
(copied into the new repo at `docs/design.md` in Task 1). Mockups: `.../specs/mockups/*.png`.

## Global Constraints

- One business, one team (one staff row, role `owner`), timezone `America/Los_Angeles`, USD, money in integer cents.
- Booking slots: Monday–Friday, starts **09:00** ("Morning") and **13:00** ("Afternoon"); duration **180 min**, **240 min** when bedrooms **> 3**.
- Every online booking is created with status `requested`, and Amanda accepts or declines it. Nothing is ever charged online.
- Minimum notice **24 h**; booking window **60 days**.
- Price = start + (bedrooms − 1) × bedroom + (full baths − 1) × full bath + half baths × half bath + extras; studio (0 bedrooms) is priced as 1 bedroom.
- Rates (cents), [start, bedroom, full bath, half bath]: Regular one-time [19100, 2500, 4200, 1500], weekly [15280, 2000, 3360, 1200], every 2 weeks [16300, 2000, 3360, 1200], every 4 weeks [18300, 2000, 3360, 1200]; Deep Clean one-time [33100, 2500, 4200, 1500]; Move In/Out one-time [33100, 2500, 4200, 1500].
- Extras (cents, per-unit?): Inside Cabinets 6500 no; Garage/Basement Full Interior Cleaning 20000 yes; Garage Floor 5500 yes; Inside Oven 4000 yes; Inside Fridge 4500 yes; Baseboards 5000 no; Balcony/Patio 7500 yes; Outside Accessible Window/Balcony Door 1700 yes; Inside Windows 5000 no; Linens & Towels 4500 yes; Handwash Dishes 4000 no; Additional Inside Window 1000 yes; Wet Wipe Window Blinds 1500 yes.
- Airbnb Turnover and Office Cleaning: quote request only; never show a price for them.
- Prices are copied onto each appointment as lines; editing rates never changes existing appointments.
- Client communication is email only (Gmail app password). No SMS sending, no iPhone Shortcuts outbox.
- Business data: name "Peninsula Gold Cleaning", phone `+16504342080`, email `bayareacserv@gmail.com`, website `https://peninsulagoldcleaning.com`, review link `https://g.page/r/CX5Xbuztgx9cEAE/review`. Amanda's private number never appears anywhere.
- Service cities (ZIP's city must be one of these): San Mateo, Foster City, Belmont, San Carlos, Redwood City, Atherton, Menlo Park, Portola Valley, Woodside, Palo Alto, Los Altos, Mountain View, Sunnyvale, Cupertino, Daly City, South San Francisco, San Francisco, Brisbane, San Bruno, Millbrae, Burlingame, Hillsborough, Santa Clara, San Jose, Milpitas, Hayward, Fremont, Union City.
- Brand: navy `#0B1F3B`, gold `#C6A45E`; app UI in English.
- Automatic emails start **off**, as in Woofers.
- Every task ends green on `npm run typecheck`, `npm run lint` and `npm run test:unit`, plus the e2e scripts the task names. One exception: after Task 4 the typecheck is red until Task 5 finishes the rename, so Tasks 4 and 5 are reviewed together.

## Review Focus

1. **Two clients pick the same slot at the same time.** Only one request may hold it; the second sees "that time was just taken". The test goes in Task 6.
2. **The price the client saw differs from the stored lines** (rates edited between page load and submit). The server recomputes from current rates, and if the total differs, the client sees the new total before it is saved. The test goes in Task 6.
3. **ZIP outside the service cities, or unknown.** A clear message to call or text, and no draft or request is created with that ZIP. The test goes in Task 3.
4. **DST weeks.** Slots on Mon Nov 2 2026 and Mon Mar 15 2027 (DST starts Mar 14) are 09:00 and 13:00 local, not shifted. The test goes in Task 3.
5. **A large home (4+ bedrooms) booked in the morning.** It runs 09:00–13:00, and the 13:00 afternoon slot stays bookable. The test goes in Task 3.

---

## Task 0: Owners create the accounts and the repo (manual, guided)

Not code. Walk the owners through it in Portuguese, one step at a time, and wait for each.

- [ ] Empty **private** GitHub repo `Steffanobreno/goldcleaning-app` (no README), then attach it to the session with `add_repo` (push access).
- [ ] Neon project `goldcleaning-app`, AWS US East 2, Postgres only. The owners keep the connection string; never paste it in chat.
- [ ] New Netlify account (later, in Task 13).

## Task 1: Repo bootstrap from Duperpower, with a working baseline

**Files:**
- Create the repo contents from `Duperpower@production` (copy the tree, without its `.git`)
- Modify: `package.json` (`name: "goldcleaning"`, add the `test:unit` script), `README.md`, `.env.example` (`DATABASE_URL=postgres://postgres@localhost:5499/goldcleaning`)
- Create: `docs/design.md` (copy of the spec), `docs/mockups/*.png`, `tests/unit/smoke.test.ts`
- Delete: `replica/` (Woofers recon and screens), `.github/workflows/messages.yml` (re-added in Task 12)

**Interfaces:**
- Produces: `npm run test:unit` = `tsx --conditions=react-server --test tests/unit/*.test.ts` (the `react-server` condition lets unit tests import modules marked `server-only`).

- [ ] **Step 1:** Copy the tree and commit it as "Start from Woofers app (Duperpower production 0208d81)", so the history shows the base.
- [ ] **Step 2:** Start a local Postgres 16 on port 5499 (`initdb` + `pg_ctl`), `npm install`, `npm run db:migrate && npm run db:seed`.
- [ ] **Step 3:** Write `tests/unit/smoke.test.ts` asserting `normalizePhone("(650) 434-2080") === "+16504342080"` (from `src/lib/format.ts`). Run `npm run test:unit` and expect PASS.
- [ ] **Step 4:** Run `npm run typecheck && npm run lint`, then `npm run dev` and `node tests/e2e/slice.mjs`. Expect PASS: the untouched Woofers baseline works here.
- [ ] **Step 5:** Commit "Add unit test runner, design doc and baseline checks" and push `main`. Create the `production` branch from `main`.

## Task 2: Pricing module

**Files:**
- Create: `src/lib/pricing.ts` (pure; no `server-only`, so the booking page can import it too), `tests/unit/pricing.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Frequency = "one_time" | "weekly" | "biweekly" | "every_4_weeks";
  export const FREQUENCY_LABEL: Record<Frequency, string>; // "One-time","Weekly","Every 2 weeks","Every 4 weeks"
  export type Rate = { startCents: number; bedroomCents: number; fullBathCents: number; halfBathCents: number };
  export type HomeSize = { bedrooms: number; fullBaths: number; halfBaths: number };
  export type ExtraPick = { serviceId: string; name: string; unitCents: number; qty: number };
  export type PriceLine = { kind: "service" | "room" | "extra"; serviceId: string | null; label: string; qty: number; unitCents: number; amountCents: number };
  export function priceLines(service: { id: string; name: string }, frequency: Frequency, rate: Rate, home: HomeSize, extras: ExtraPick[]): PriceLine[];
  export function totalCents(lines: PriceLine[]): number;
  export function durationMinutes(home: HomeSize, rule: { baseMin: number; largeHomeBedrooms: number; largeHomeExtraMin: number }): number;
  ```

- [ ] **Step 1: Write the failing tests** in `tests/unit/pricing.test.ts` with the Global Constraints rates:
  - `regular one-time 3bd/2ba/1half totals 29800`
  - `regular weekly 3bd/2ba/1half totals 23840`
  - `studio (0 bd) 1 ba one-time totals 19100, same as 1 bd`
  - `1bd/1ba has a single service line and no room lines`
  - `deep clean 4bd/3ba totals 49000`
  - `extras: weekly 3/2/1 + Inside Cabinets x1 + Inside Oven x1 + Inside Fridge x1 totals 38840`
  - `extra with qty 0 adds no line`
  - `lines: the first line is the service at start price, the label carries the frequency ("Regular Clean · Weekly")`; then room lines "Extra bedroom" ×2, "Extra full bath" ×1, "Half bath" ×1; then extras in input order.
  - `duration: 3 bd → 180; 4 bd → 240` with rule `{ baseMin: 180, largeHomeBedrooms: 3, largeHomeExtraMin: 60 }`
- [ ] **Step 2:** Run `npm run test:unit` and expect FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/pricing.ts`. Bedrooms below 1 count as 1, and full baths below 1 count as 1.
- [ ] **Step 4:** Run `npm run test:unit` and expect PASS.
- [ ] **Step 5:** Commit "Add flat-rate pricing for cleaning".

## Task 3: Fixed daily slots and service area

**Files:**
- Create: `src/lib/slots.ts` (pure), `tests/unit/slots.test.ts`, `tests/unit/service-area.test.ts`
- Modify: `src/lib/booking.ts` (replace the grid/cluster logic of `findSlots`; replace `zipProblem`)

**Interfaces:**
- Produces:
  ```ts
  // slots.ts
  export type SlotDef = { weekday: number; start: string; label: string }; // weekday 0=Sun, start "HH:MM"
  export type Busy = { start: Date; end: Date };
  export type DaySlots = { date: string; label: string; times: { value: string; label: string; slotLabel: string }[] };
  export function openSlots(a: { firstDay: string; days: number; tz: string; slots: SlotDef[]; durationMin: number; busy: Busy[]; earliest: Date }): DaySlots[];
  // booking.ts
  export function zipProblem(b: PublicBusiness, zip: string): string | null; // uses zipInfo(zip).city ∈ b.service_cities (case-insensitive)
  export async function findSlots(b: PublicBusiness, durationMin: number, onlyDate?: string): Promise<DaySlots[]>;
  ```
  `PublicBusiness` loses `buffer_minutes`, `max_cluster_miles`, `slot_minutes`, `start_zip`, `service_radius_miles` and gains `service_cities: string[]`, `base_duration_min`, `large_home_bedrooms`, `large_home_extra_min`.
- Consumes: `zonedToUtc`, `dayRangeUtc`, `addDaysYmd`, `weekdayOf`, `timeLabel`, `dayLabel` from `src/lib/format.ts`.

A slot is open when `[start, start+durationMin)` overlaps no busy interval (active appointments and time off) and `start ≥ earliest`. Days with no open slot are omitted.

- [ ] **Step 1: Write failing tests** (`slots.test.ts`), with slots Mon–Fri 09:00/13:00:
  - `empty Monday 2026-11-09 offers 09:00 and 13:00, labeled "Morning" and "Afternoon"`
  - `a booking 09:00–12:00 leaves only 13:00`
  - `large home: duration 240 offers 09:00 (until 13:00) and 13:00; and with 09:00–13:00 busy, 13:00 is still offered`
  - `time off covering the day offers nothing, and the day is omitted`
  - `Saturday and Sunday offer nothing`
  - `earliest = Mon 10:00 local hides Monday 09:00 and keeps Monday 13:00`
  - `DST: 2026-11-02 09:00 local is 17:00Z; 2027-03-15 09:00 local is 16:00Z`
- [ ] **Step 2: Write failing tests** (`service-area.test.ts`): `zipProblem` returns null for 94401, 94027, 95014, 94110 and 94538; returns the outside-area message for 95060 (Santa Cruz); returns the unknown-ZIP message for 00000.
- [ ] **Step 3:** Run `npm run test:unit` and expect FAIL.
- [ ] **Step 4:** Implement `openSlots`, then rewire `findSlots` to load slot defs, busy and time off, and call it. Remove the `near`/`best` logic.
- [ ] **Step 5:** Run `npm run test:unit` and expect PASS. Commit "Book two fixed daily slots; check the ZIP's city".

## Task 4: Cleaning schema and seed

**Files:**
- Create: `db/migrations/0018_cleaning.sql`
- Rewrite: `scripts/seed.ts` (Gold Cleaning data; delete `scripts/agreement.ts` content and keep an empty agreement, off)
- Create: `tests/e2e/schema.mjs` (Node + postgres.js; asserts on a freshly migrated and seeded database)

**Interfaces (database, used by every later task):**
- `pets` → **`homes`**: drop species, breed, birth_date, weight_lbs, coat_type, size_class, rebook_every_days, sex, fixed, behavior, vet_name, vet_phone, photo_url, deceased_at. Add label (default 'Home'), address_line, city, state (default 'CA'), zip, lat, lng, bedrooms smallint 0–7 (default 1), full_baths 1–7 (default 1), half_baths 0–7 (default 0), access_method (`home`|`key`|`lockbox`|`door_code`), access_code, parking_notes, pets_in_home, product_preferences, archived_at. `notes` is kept.
- `appointment_pets` → **`appointment_homes`** (`pet_id` → `home_id`). `appointment_services` → **`appointment_lines`** (`appointment_pet_id` → `appointment_home_id`; `service_id` becomes nullable; add `kind` (`service`|`room`|`extra`|`adjustment`, default `service`) and `qty int not null default 1`). `price_cents` is the line amount.
- `appointments`: add `service_id uuid references services` and `frequency text not null default 'one_time'` (the 4 Frequency values); drop route_order and drive_minutes_from_prev.
- `services`: drop size_class; kind check becomes `service|extra`; add `pricing text not null default 'rate' check (pricing in ('rate','quote'))`, `recurring boolean not null default false`, `per_unit boolean not null default false`, `icon text`.
- New `service_rates (id, service_id → services on delete cascade, frequency, start_cents, bedroom_cents, full_bath_cents, half_bath_cents, unique (service_id, frequency))`.
- New `booking_slots (id, business_id, weekday 0–6, start_time time, label text, unique (business_id, weekday, start_time))`.
- New `quote_requests (id, business_id, kind ('airbnb'|'office'), first_name, last_name, email, phone, city, zip, bedrooms, full_baths, square_feet int, frequency text, message text, status ('new'|'replied'|'converted'|'archived') default 'new', client_id → clients null, created_at, updated_at)` and `quote_request_photos (id, quote_request_id on delete cascade, content_type, data bytea, created_at)`, the same storage approach as Woofers `pet_photos`.
- `businesses`: add `service_cities text[] not null default '{}'`, `base_duration_min int not null default 180`, `large_home_bedrooms int not null default 3`, `large_home_extra_min int not null default 60`, `review_url text`, `website_url` (if missing). Drop buffer_minutes, max_cluster_miles, slot_minutes, start_zip, service_radius_miles.
- `booking_drafts`: rename `pets` → `summary`, and `pet_details` → `details jsonb` (service, frequency, home size, extras, total_cents).
- Drop: vaccines, pet_codes, pet_pet_codes, pet_photos, grooming_reports, route_rules, service_areas, service_prices.
- `message_templates` trigger check: add `quote_received`, `quote_new`; remove `on_my_way`, `report`, `vaccine_due`.
- RLS is enabled on every new table, as in the Woofers migrations.

- [ ] **Step 1: Write failing** `tests/e2e/schema.mjs`. After migrate and seed it asserts:
  - 5 `kind='service'` services: Regular Clean (rate, recurring), Deep Clean (rate), Move In/Out Clean (rate), Airbnb Turnover (quote) and Office Cleaning (quote);
  - 6 `service_rates` rows equal to the Global Constraints values;
  - 13 extras with those prices and `per_unit` flags;
  - `booking_slots` = 10 rows (Mon–Fri × 09:00/13:00);
  - `businesses.service_cities` has 28 entries;
  - `min_notice_hours = 24` and `booking_days_ahead = 60`;
  - `online_requires_approval = true`;
  - no table named `pets`.
- [ ] **Step 2:** Run it on a fresh database and expect FAIL.
- [ ] **Step 3:** Write the migration and the seed (idempotent, like the Woofers seed). Email templates are in English and signed "Peninsula Gold Cleaning", with these triggers: `request_received`, `request_accepted`, `request_declined`, `reminder` (1 day before, 10:00), `cancelled`, `thank_you`/`review_request` (120 min after checkout, with the review link), `abandoned_booking` (120 min), `quote_received`, `quote_new`.
- [ ] **Step 4:** Run it again and expect PASS. `npm run typecheck` fails on purpose here; Task 5 fixes it.
- [ ] **Step 5:** Commit "Reshape the schema for cleaning; seed Gold Cleaning".

## Task 5: Data layer and owner screens move from pets to homes

**Files (modify; listed because they reference pets today):** `src/lib/data/{appointments,clients,reports,abandoned,marketing}.ts`, `src/lib/{backup,client-calendar,clients-csv,email,messaging}.ts`, `src/lib/import/{clients-csv,write-clients}.ts`, `src/app/(owner)/{today,calendar,requests,reports}/page.tsx`, `src/app/(owner)/appointments/**`, `src/app/(owner)/clients/**`, `src/app/(owner)/settings/{backups,calendar,import,messages/preview}/**`, `src/app/a/[token]/*`, `src/app/api/device/calendar/route.ts`, `src/components/side-menu.tsx`.
**Delete:** `src/lib/breeds.ts`, `src/lib/data/vaccines.ts`, `src/lib/pet-photos.ts`, `src/components/{pet-photo,breed-options}.tsx`, `src/app/api/pets/`, `src/app/(owner)/clients/[id]/pets/`, `src/app/(owner)/clients/pet-photo-upload.tsx`, `tests/e2e/vaccines.mjs`.
**Create:** `src/app/(owner)/clients/[id]/homes/new/page.tsx`, `src/app/(owner)/clients/[id]/homes/[homeId]/page.tsx`, `src/lib/data/homes.ts`.

**Interfaces:**
- Produces (in `src/lib/data/appointments.ts`): `AppointmentListItem` replaces `pets` with `home: { id: string; label: string; bedrooms: number; full_baths: number; half_baths: number; access_method: string | null } | null`, plus `service_name: string | null` and `frequency: Frequency`; `total_cents` = the sum of `appointment_lines.price_cents`.
- Produces (in `src/lib/data/homes.ts`): `listHomes(staff, clientId)`, `getHome(staff, id)`, `upsertHome(staff, input: HomeInput): Promise<string>`.
- Produces: `createAppointmentWithLines(tx, a: { businessId; clientId; staffId; homeId; serviceId; frequency; startAt: Date; durationMin: number; status; source; notes: string | null; lines: PriceLine[] }): Promise<string>`. Every creation path (owner form, online request, repeat) uses it.
- Consumes: `priceLines`, `totalCents`, `durationMinutes` (Task 2).

Owner appointment form: client → home (or new home inline) → service (rate services only) → frequency (if recurring) → extras grid → live total from `priceLines` → date and time. Adjustments are an `adjustment` line.

- [ ] **Step 1:** Rewrite `tests/e2e/slice.mjs` for cleaning: owner login → new client "Ana Silva" with home 3bd/2ba/1half in 94401 → appointment Regular, weekly, Inside Oven ×1, Tue 09:00 → appointment page shows total **$278.40** → mark completed → checkout records Venmo $278.40 + tip $20 → invoice closed. Run it and expect FAIL.
- [ ] **Step 2:** Make it pass. The mechanical rename comes first, then the form. `npm run typecheck && npm run lint` must be clean.
- [ ] **Step 3:** Run `node tests/e2e/slice.mjs` and expect PASS. Commit "Homes instead of pets across the owner app".

## Task 6: Client booking page (Clover flow)

**Files:**
- Rewrite: `src/app/book/booking-wizard.tsx` (split into `src/app/book/steps/{service,frequency,home,extras,contact,date,address,access,review}.tsx` and `src/app/book/price-summary.tsx`), `src/app/book/actions.ts`
- Keep: `src/app/book/month-calendar.tsx`, `src/app/book/page.tsx` (`?embed=1` hides the header and footer)
- Delete: `src/app/book/signature-pad.tsx` usage while the agreement is off (keep the file for the agreement feature)
- Rewrite: `tests/e2e/booking.mjs`, `tests/e2e/abandoned.mjs`

**Interfaces:**
- Produces (server actions in `src/app/book/actions.ts`):
  - `bookingCatalogAction(): Promise<{ services: {id,name,pricing,recurring}[]; rates: Record<serviceId, Partial<Record<Frequency, Rate>>>; extras: {id,name,unitCents,perUnit,icon}[]; rule: {baseMin,largeHomeBedrooms,largeHomeExtraMin} }>`
  - `saveDraftAction(d: { draftId?: string; phone: string; firstName: string; lastName: string; email: string; step: string; details: DraftDetails }): Promise<{ draftId: string }>` (called when the contact step is completed, and again at each later step)
  - `slotsAction(durationMin: number, month: string): Promise<DaySlots[]>`
  - `requestBookingAction(r: { draftId: string; serviceId; frequency; home: HomeSize; extras: {serviceId; qty}[]; start: string; address: {line; apt; city; zip}; access: {method; code; parking; pets; notes}; shownTotalCents: number }): Promise<{ ok: true } | { error: string; newTotalCents?: number }>`
- Consumes: `priceLines`/`totalCents`/`durationMinutes` (Task 2), `findSlots`/`zipProblem` (Task 3), `createAppointmentWithLines` (Task 5), `notifyAppointment(id, "request_received")` and `notifyOwner(...)` (`src/lib/messaging.ts`).

`requestBookingAction` does the following:
- matches or creates the client by phone (as in Woofers) and creates or updates their home;
- recomputes the lines from current rates;
- if the total differs from `shownTotalCents`, returns `{ error, newTotalCents }` and saves nothing;
- in one transaction, re-checks that the slot is free (relying on `no_double_booking_online`) and creates the appointment `requested`, `source='online'`;
- marks the draft completed.

The sticky summary shows the service line, room lines, extras and total, collapsed to one line plus the total, as in mockup 3. When the service is Airbnb or Office, the page shows the quote form instead (Task 7).

- [ ] **Step 1: Write failing** `tests/e2e/booking.mjs`:
  - a new client picks Regular → Weekly → 3/2/1 → Inside Oven and Inside Fridge → sees **$323.40** → contact → first open day → Morning → address in 94401 → lockbox → Request booking;
  - the owner Requests list shows it at $323.40 → Accept → client status confirmed;
  - **race:** two browser contexts request the same slot, and the second gets "That time was just taken" (Review Focus 1);
  - **price changed:** the test edits the Regular weekly start rate in the database between the summary and submit, the client sees the new total and must press Request again (Review Focus 2);
  - a ZIP of 95060 shows the out-of-area message and creates no draft row with that ZIP (Review Focus 3).
- [ ] **Step 2:** Run it against `npm run dev` and expect FAIL.
- [ ] **Step 3:** Implement the steps, the summary and the actions.
- [ ] **Step 4:** Run `node tests/e2e/booking.mjs && node tests/e2e/abandoned.mjs` and expect PASS (abandoned: contact filled, page left, the owner Abandoned list shows the service, size and total, and Email/Call/Dismiss work). Commit "Clover-style booking page with live price".

## Task 7: Quote requests (Airbnb and Office)

**Files:**
- Create: `src/app/book/steps/quote-form.tsx`, `src/lib/data/quotes.ts`, `src/app/(owner)/requests/quotes.tsx`, `src/app/(owner)/requests/quote-actions.ts`, `src/app/api/quotes/[id]/photo/[photoId]/route.ts`, `tests/e2e/quotes.mjs`
- Modify: `src/app/book/actions.ts` (`requestQuoteAction`), `src/app/(owner)/requests/page.tsx` (tabs Bookings | Quotes), `src/lib/messaging.ts` (`quote_received` to the client, `quote_new` to the owner)

**Interfaces:**
- Produces: `requestQuoteAction(q: { kind: "airbnb" | "office"; firstName; lastName; email; phone; city; zip; bedrooms?: number; fullBaths?: number; squareFeet?: number; frequency: string; message: string; photos: string[] /* data URLs, resized in the browser, max 5 */ }): Promise<{ ok: true } | { error: string }>`; `listQuotes(staff, status)`; `setQuoteStatus(staff, id, status)`; `convertQuote(staff, id): Promise<{ clientId: string }>` (creates or matches the client and opens the new-appointment form for them).
- Consumes: `resizeImage` (`src/lib/resize-image.ts`), `normalizePhone`.

- [ ] **Step 1: Write failing** `tests/e2e/quotes.mjs`: choosing Airbnb Turnover shows no price anywhere and shows the quote form; submitting it with one photo shows a thank-you; the owner sees it under Requests → Quotes with the photo; "Convert to client and booking" opens the new appointment form for that client; Archive removes it from the list.
- [ ] **Step 2:** Run it and expect FAIL. Implement. Run it and expect PASS.
- [ ] **Step 3:** Commit "Quote requests for Airbnb and Office".

## Task 8: Recurring series from the frequency

**Files:** Modify `src/app/(owner)/requests/page.tsx` accept flow, `src/app/(owner)/appointments/repeat-actions.ts`, `src/lib/repeat.ts`; rewrite `tests/e2e/repeat.mjs`.

**Interfaces:**
- Produces: `seriesForFrequency(f: Frequency): { freq: "week"; interval: 1 | 2 | 4 } | null` (in `src/lib/repeat.ts`), and `acceptRequest(staff, appointmentId)`, which, when the frequency is not `one_time`, creates the series and the next occurrences up to the booking window (60 days). Each occurrence gets the same lines, a free-slot check, and a conflict list for the owner.

- [ ] **Step 1: Write a failing unit test** in `tests/unit/repeat.test.ts`: weekly → interval 1, biweekly → 2, every_4_weeks → 4, one_time → null.
- [ ] **Step 2:** Write failing `tests/e2e/repeat.mjs`: accept a biweekly request on Tue 09:00, and the calendar shows it every 2 weeks for 60 days with the same total; when one of those dates is already taken, it appears as a conflict and is not created.
- [ ] **Step 3:** Implement. Run both and expect PASS. Commit "Recurring cleanings from the booked frequency".

## Task 9: Calendar Year view, and Today with distances

**Files:** Modify `src/app/(owner)/calendar/page.tsx` (add `year` to `VIEWS`), create `src/app/(owner)/calendar/year-view.tsx`; modify `src/app/(owner)/today/page.tsx`.

**Interfaces:**
- Produces: `dayFill(appointments: {start_at: Date; status: string}[], tz: string): Map<string /*ymd*/, 0 | 1 | 2>` in `src/lib/calendar-fill.ts`. Active statuses count; `cancelled`, `declined` and `no_show` don't.

- [ ] **Step 1: Write failing unit tests** for `dayFill`: two active cleanings on one day → 2; one active and one cancelled → 1; none → absent from the map.
- [ ] **Step 2:** Implement the Year view as 12 mini-months colored free / one slot / full, where tapping a day opens the Day view. Today shows the homes in time order on `RouteMap`, the "↓ X.X mi" straight-line distance between consecutive homes (`zipMiles`), and a Directions button per home.
- [ ] **Step 3:** Run `npm run test:unit`, then check by hand on `/calendar?view=year` and `/today` with seeded data. Commit "Year view and distances between homes".

## Task 10: Reports for a cleaning business

**Files:** Modify `src/lib/data/reports.ts` and `src/app/(owner)/reports/page.tsx`.

**Interfaces:**
- Produces: `report(staff, from, to, group)` returns its existing fields, plus `byService: { name: string; cents: number }[]`, `averageTicketCents: number`, `cleanings: number`, `recurringClients: number`, `recurringMonthlyCents: number` (weekly × 52/12, every 2 weeks × 26/12, every 4 weeks × 13/12, using each series' current per-visit total), `cancellations: number` and `noShows: number`.

- [ ] **Step 1:** Write a failing e2e assertion in `tests/e2e/slice.mjs` (or `reports.mjs`): after the slice's paid appointment, Reports → This month shows Collected $298.40 (including the tip, as Woofers does today), Cleanings 1, and Regular Clean listed under By service.
- [ ] **Step 2:** Implement. Run it and expect PASS. Commit "Cleaning reports".

## Task 11: Email only (no SMS), cleaning wording

**Files:** Modify `src/lib/messaging.ts`, `src/lib/email.ts`, `src/app/(owner)/settings/messages/**`, `src/app/(owner)/abandoned/contact-buttons.tsx`, `src/app/(owner)/settings/notifications/**`. Delete `src/app/api/device/outbox/`, `src/lib/device.ts` (outbox parts) and the Shortcut setup UI.

**Interfaces:**
- Produces: `notifyAppointment(id, trigger)` enqueues **email only**; a client without email gets nothing and the owner sees "no email on file". Template variables: `{client}`, `{business}`, `{date}`, `{time}`, `{service}`, `{home}` ("3 bd / 2 ba"), `{total}`, `{appointment_url}`, `{booking_url}`, `{review_url}`, `{business_phone}`.
- Abandoned "Call" is a `tel:` link and "Email" sends `abandoned_booking` now.

- [ ] **Step 1: Write failing unit tests** for the template rendering (`renderTemplate(body, vars)` in `src/lib/messaging-render.ts`): every variable above is replaced; an unknown `{x}` stays as is.
- [ ] **Step 2:** Implement, and remove every SMS path (`grep -ri "sms\|outbox\|shortcut" src` returns only `sms:` links). Run the e2e suite and expect PASS. Commit "Email-only messages for Gold Cleaning".

## Task 12: Brand, PWA, settings and jobs

**Files:**
- Modify: `src/app/globals.css` (tokens: navy `#0B1F3B`, gold `#C6A45E`), `src/app/manifest.ts` (name "Gold Cleaning", short_name "Gold"), `src/app/icon.png`, `src/app/apple-icon.png` (from the site's `public/logo-icon.png`), the login and setup pages
- Modify: `src/app/(owner)/settings/{business,booking,hours,services}/**`. The **Booking** settings hold the slots, the duration rule, min notice, the window and the service cities. The **Services** settings become the **Price list**: the rate table per service × frequency, and extras (name, price, per-unit, icon, active).
- Re-add: `.github/workflows/messages.yml` (hourly cron calling `/api/cron/messages` with `CRON_SECRET`)
- Rewrite: `docs/guia-configuracao.md` for Gold: the Neon US East 2 connection string, the new Netlify account with the `production` branch only, Gmail `bayareacserv@gmail.com` with an app password, the Google Calendar script, backups to the Gold Google Drive, Add to Home Screen and notifications. No SMS section.

- [ ] **Step 1:** e2e (`tests/e2e/slice.mjs` addition): editing the Regular weekly start rate to $160.00 in Price list changes a new quote on `/book` to the new value, and the earlier appointment keeps $278.40.
- [ ] **Step 2:** Implement. Run all checks and the whole e2e suite. Take screenshots of the 4 mockup screens and compare them with `docs/mockups/` by eye. Commit "Gold Cleaning brand, price list and settings".

## Task 13: Deploy with the owners

- [ ] Walk the owners through `docs/guia-configuracao.md`. On Netlify (new account): import `goldcleaning-app`, production branch `production`, set the env vars (they paste `DATABASE_URL` themselves), deploy. Then open `/setup` and create Amanda's login with `SETUP_CODE`.
- [ ] Smoke test in production: book a Regular one-time request from a phone, accept it in the app, and receive both emails at a test address.
- [ ] Optional domain `app.peninsulagoldcleaning.com` (CNAME at the domain's DNS).

## Task 14: Website integration (repo `peninsulagoldcleaning`)

**Files:** Modify `src/pages/BookNow.tsx` to show the app in an iframe (`${APP_URL}/book?embed=1`), the way `woofersdogspa/src/pages/Booking.tsx` does: a slim title bar, a "slow to load → open in a new tab or call" fallback after 10 s, and a preconnect to the app origin. Add `src/data/booking.ts` with `BOOKING_APP_URL`. The old form moves to `src/pages/EstimateForm.tsx` and stays reachable at `/estimate` (noindex) until the new flow is proven.

- [ ] **Step 1:** Build and prerender; `/book-now` contains the iframe and an `<h1>`, and Lighthouse on `/` and a city page stays at 98–100 (`/book-now` is exempt per the spec).
- [ ] **Step 2:** Commit "Book now opens the Gold Cleaning booking app" and push to the site branch (PR #1 or a new PR if merged).
