# Build log

| ID | date | state | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S01 login + first-run setup | 2026-10-18 | done | password reset (owner can be reset in the DB for now) | — |
| S02/S03 Today (route of the day) | 2026-10-18 | partial | drive time between stops, route optimization (needs Google key, marco 2d) | — |
| S04 calendar | 2026-10-18 | partial | hour grid, drag to reschedule, month view | — |
| S05 new appointment | 2026-10-18 | done | recurring series (S07), slot suggestions | React 19 resets forms after submit; added ActionForm |
| S06 appointment detail | 2026-10-18 | done | SMS on status change (marco 2c) | — |
| S09–S11 clients and pets | 2026-10-18 | done | vaccines (S12), pet codes, photo | — |
| S13 checkout | 2026-10-18 | done | receipt by text | tip-only payments needed a schema change |
| S17/S18 settings: services, hours, business | 2026-10-18 | done | logo, time off, van start address | — |

Verified by `npm run test:e2e` on a fresh database at 390px: setup → client → pet → book
($194) → double booking refused → Today + Google Maps route → status flow → Venmo + 20% tip → paid.
Screenshots in `replica/clone-screens/`.
| S30–S38 online booking (/book) | 2026-10-18 | done | login for returning clients (they're matched by phone instead) | ZIP data: census.gov blocked, used the BSD `zipcodes` package |
| S08 booking requests | 2026-10-18 | done | — | — |
| /a/[token] client confirm/cancel page | 2026-10-18 | done | reschedule from the link | replaces "reply Y/N", since texts come from the owner's iPhone |
| messaging (email + iPhone outbox) | 2026-10-18 | done | review rating flow | no paid SMS: the iPhone Shortcut sends from the owner's AT&T line |
| S20 texts and email settings, booking settings | 2026-10-18 | done | — | — |
| Google Calendar feed (ICS) | 2026-10-18 | done | instant sync (Google refreshes subscriptions every few hours) | — |

Verified by `npm run test:e2e` + `node tests/e2e/booking.mjs`: request on /book → a ZIP 40 mi away
is not offered that day → owner accepts → outbox returns the client's texts once → client confirms
from the link → calendar feed lists the visit and refuses a wrong key.
| Import clients (CSV) | 2026-10-18 | done | — | real export: 389/390 clients, 470 pets, 23/26 future visits (3 overlap, 1 bad phone); re-import adds nothing |
| Service agreement + signing | 2026-10-18 | done | drawn signature (typed name instead) | owner's own text transcribed from screenshots; section 9 cut off |
| Vaccines | 2026-10-18 | partial | certificate photo/PDF upload | — |
| Automatic messages switch | 2026-10-18 | done | — | off by default so clients don't get doubles while the old app runs |
| Booking page: phone login | 2026-10-18 | done | verification code (no paid SMS); page reveals only first name, pets, city | — |
| Pet photos | 2026-10-18 | done | — | stored in Postgres (resized in the browser) to avoid a file service |
| Owner feedback round | 2026-10-18 | done | — | overlaps warn instead of block; 50% late-cancel fee; vaccines hidden; no driving buffer; real import now brings 26/26 future visits |
