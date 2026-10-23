// Ready-made campaigns, written to get bookings without sounding the same every month.
// Each has its own angle (we miss you, a cleaning tip, a full calendar, a season, a holiday),
// the inbox preview line, and who it should go to by default. The owner edits everything
// before sending, and can add a picture. {first_name}, {business} and {booking_link} are
// filled in for each client.

import type { Filters } from "./data/marketing";

export type MarketingTemplate = {
  key: string;
  name: string;
  kind: "anytime" | "season";
  /** The date this year it's about (yyyy-MM-dd); null for any time. */
  date: ((year: number) => string) | null;
  subject: string;
  preheader: string; // the grey line next to the subject in the inbox
  headline: string;
  body: string;
  button: string;
  banner: string | null;
  filters: Partial<Filters>; // the starting audience
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** The n-th weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return ymd(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return ymd(y, m, lastDay - ((last - weekday + 7) % 7));
}
const sign = "\n\nSee you soon,\nThe {business} team";
const notBooked: Partial<Filters> = { upcoming: "none" };

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  // ------------------------------------------------------------------ any time
  {
    key: "we-miss-you", name: "We miss you", kind: "anytime", date: null, banner: null, filters: notBooked,
    subject: "It's been a while, {first_name} ✨",
    preheader: "Your home deserves a fresh start.",
    headline: "We miss your home!",
    body: "Hi {first_name},\n\nIt's been a little while since our last visit. Life gets busy, we get it. Let us take the cleaning off your list so you can enjoy your weekend.\n\nPick a day online in a minute, and you'll see the price before you book." + sign,
    button: "Book a cleaning",
  },
  {
    key: "spot-waiting", name: "Your spot is waiting", kind: "anytime", date: null, banner: null, filters: notBooked,
    subject: "Your cleaning spot is waiting 🗓️",
    preheader: "Mornings and afternoons, Monday to Friday.",
    headline: "A spotless home is one click away",
    body: "Hi {first_name},\n\nWe still have morning and afternoon openings in the coming weeks. Choose your day, tell us about your home, and we'll take care of the rest.\n\nYou'll get a confirmation by email within 24 hours." + sign,
    button: "See open days",
  },
  {
    key: "deep-clean-tip", name: "Time for a deep clean", kind: "anytime", date: null, banner: null, filters: notBooked,
    subject: "5 spots a regular clean can't reach",
    preheader: "Baseboards, inside the oven, grout and more.",
    headline: "Is it time for a deep clean?",
    body: "Hi {first_name},\n\nA few signs it's time for a deep clean:\n\n1. Dust on the baseboards and door frames\n2. Grout that looks darker than it used to\n3. Spills baked onto the inside of the oven\n4. Fingerprints on cabinets and switches\n5. Window tracks full of dust\n\nOur Deep Clean covers all of that, top to bottom. Add inside the fridge or oven as extras." + sign,
    button: "Book a deep clean",
  },
  {
    key: "filling-up", name: "Calendar filling up", kind: "anytime", date: null, banner: null, filters: notBooked,
    subject: "Our calendar is filling up",
    preheader: "Book now to get the day you want.",
    headline: "Spots are going fast",
    body: "Hi {first_name},\n\nThe next few weeks are filling up, and we'd love to save a spot for you.\n\nBook now to get the day and time that fit you best." + sign + "\n\nP.S. Want to never think about it again? Choose every 2 or 4 weeks and save on every cleaning.",
    button: "Book now",
  },
  {
    key: "recurring", name: "Set it and forget it", kind: "anytime", date: null, banner: null, filters: {},
    subject: "A clean home every week, without thinking about it",
    preheader: "Recurring cleanings cost less per visit.",
    headline: "Set it and forget it",
    body: "Hi {first_name},\n\nThe easiest way to keep your home fresh: a recurring cleaning. Choose weekly, every 2 weeks or every 4 weeks, and we keep the same day for you.\n\nRecurring cleanings cost less per visit than a one-time cleaning, and you can move one anytime." + sign,
    button: "Choose my schedule",
  },
  {
    key: "refer-friend", name: "Share the love (referrals)", kind: "anytime", date: null, banner: null, filters: {},
    subject: "Know someone who'd love a clean home? 💛",
    preheader: "Most of our new clients come from people like you.",
    headline: "Share the love",
    body: "Hi {first_name},\n\nWe're a small local business, and most of our new clients come from people like you. If a friend, neighbor or family member could use a hand at home, we'd be so grateful if you passed our name along.\n\nThey can see the price and book online in a minute." + sign,
    button: "Share our booking page",
  },
  {
    key: "move-season", name: "Moving soon?", kind: "anytime", date: null, banner: null, filters: {},
    subject: "Moving? We'll leave it spotless",
    preheader: "Move-in and move-out cleanings, inside cabinets and appliances.",
    headline: "Moving in or out?",
    body: "Hi {first_name},\n\nWhether you're getting your deposit back or settling into a new place, our Move In/Out cleaning covers everything: inside cabinets and drawers, appliances, baseboards and floors.\n\nKnow someone who's moving? Send them our way!" + sign,
    button: "Book a move-out clean",
  },

  // ------------------------------------------------------------------ seasons and holidays
  {
    key: "new-year", name: "New Year", kind: "season", date: (y) => ymd(y, 1, 2), banner: null, filters: notBooked,
    subject: "Start the year fresh ✨",
    preheader: "A clean home for a clean start.",
    headline: "Happy New Year!",
    body: "Hi {first_name},\n\nAfter the holidays, nothing feels better than a clean, calm home. Start the year fresh: we'll take care of the kitchen, bathrooms, floors and everything in between.\n\nEarly January fills up fast, so book your day now." + sign,
    button: "Book my cleaning",
  },
  {
    key: "spring", name: "Spring cleaning", kind: "season", date: (y) => ymd(y, 3, 15), banner: null, filters: notBooked,
    subject: "Spring cleaning season is here 🌷",
    preheader: "Open the windows, we'll do the rest.",
    headline: "Spring cleaning time",
    body: "Hi {first_name},\n\nSpring is the perfect time for a top-to-bottom clean: baseboards, inside windows, blinds and all the corners winter left behind.\n\nSpring is our busiest season, so book early to get the day you want." + sign,
    button: "Book a spring clean",
  },
  {
    key: "mothers-day", name: "Mother's Day", kind: "season", date: (y) => nthWeekday(y, 5, 0, 2), banner: null, filters: {},
    subject: "The gift of a clean home 💐",
    preheader: "Give Mom a day off this Mother's Day.",
    headline: "Happy Mother's Day!",
    body: "Hi {first_name},\n\nLooking for a gift Mom will really use? Give her a day off: a full cleaning of her home, done by our team.\n\nBook it for her online and add any extras she'd love." + sign,
    button: "Book a cleaning for Mom",
  },
  {
    key: "summer", name: "Summer refresh", kind: "season", date: (y) => nthWeekday(y, 5, 1, -1), banner: null, filters: notBooked,
    subject: "Summer's here: refresh your home ☀️",
    preheader: "Patio, windows and everything in between.",
    headline: "Ready for summer?",
    body: "Hi {first_name},\n\nLonger days, guests and backyard dinners are coming. Get your home ready with a fresh cleaning, and add the balcony or patio and outside windows as extras.\n\nSummer days book up quickly, so choose yours now." + sign,
    button: "Book a summer clean",
  },
  {
    key: "back-to-routine", name: "Back to routine", kind: "season", date: (y) => ymd(y, 8, 15), banner: null, filters: notBooked,
    subject: "Back to routine 🎒",
    preheader: "A clean home makes busy weeks easier.",
    headline: "Back to routine",
    body: "Hi {first_name},\n\nSummer is winding down and calendars are filling up. It's the perfect time to get your home back on a regular cleaning schedule.\n\nChoose weekly or every 2 weeks and keep the same day all fall." + sign,
    button: "Choose my day",
  },
  {
    key: "holiday-booking", name: "Holiday spots open", kind: "season", date: (y) => ymd(y, 11, 5), banner: null, filters: notBooked,
    subject: "Holiday cleaning spots are open 🎁",
    preheader: "Thanksgiving and December weeks book up first.",
    headline: "Get ready for the holidays",
    body: "Hi {first_name},\n\nEvery year, the weeks before Thanksgiving and Christmas are the first to fill up. We're opening them now so our clients get first pick.\n\nChoose a day close to the holiday, and your home will be ready when the family arrives." + sign,
    button: "Get a holiday spot",
  },
  {
    key: "holidays", name: "Happy Holidays", kind: "season", date: (y) => ymd(y, 12, 20), banner: null, filters: {},
    subject: "Happy Holidays from all of us 🎄",
    preheader: "Thank you for a wonderful year.",
    headline: "Happy Holidays!",
    body: "Hi {first_name},\n\nThank you for welcoming us into your home this year. It's been a pleasure.\n\nWishing you a cozy, happy holiday season. We can't wait to see you in the new year!" + sign,
    button: "Book for the new year",
  },
  {
    key: "blank", name: "Start from scratch", kind: "anytime", date: null, banner: null, filters: {},
    subject: "", preheader: "", headline: "", body: "Hi {first_name},\n\n" + sign.trimStart(), button: "Book now",
  },
];

export const templateByKey = (key: string | null) => MARKETING_TEMPLATES.find((t) => t.key === key) ?? null;

/** The next date (today or later) the template is about. */
export function nextDate(t: MarketingTemplate, today: string) {
  if (!t.date) return null;
  const y = Number(today.slice(0, 4));
  const d = t.date(y);
  return d >= today ? d : t.date(y + 1);
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * What to send now: the season or holiday coming up in the next ~5 weeks that wasn't sent in
 * the last 10 months, then the any-time emails not sent for the longest. `lastSent` maps a
 * template key to the day it last went out.
 */
export function suggestions(today: string, lastSent: Record<string, string | undefined>) {
  const fresh = (t: MarketingTemplate, days: number) => !lastSent[t.key] || daysBetween(lastSent[t.key]!, today) > days;
  const seasons = MARKETING_TEMPLATES
    .filter((t) => t.kind === "season" && fresh(t, 300))
    .map((t) => ({ t, next: nextDate(t, today)! }))
    .filter(({ next }) => daysBetween(today, next) <= 35)
    .sort((a, b) => (a.next < b.next ? -1 : 1))
    .map(({ t }) => t);
  const anytime = MARKETING_TEMPLATES
    .filter((t) => t.kind === "anytime" && t.key !== "blank" && fresh(t, 75))
    .sort((a, b) => (lastSent[a.key] ?? "") < (lastSent[b.key] ?? "") ? -1 : 1);
  return [...seasons, ...anytime].slice(0, 3);
}
