// Ready-made campaigns, written to get bookings without sounding the same every month.
// Each has its own angle (we miss you, a grooming tip, a full calendar, a season, a holiday),
// its own picture (public/marketing/<key>.jpg, drawn for Woofers), the inbox preview line,
// and who it should go to by default. The owner edits everything before sending.
// {first_name}, {pet_name}, {business} and {booking_link} are filled in for each client.

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
/** Easter Sunday (Gregorian calendar). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

const sign = "\n\nSee you soon,\nThe {business} team";
const notBooked: Partial<Filters> = { upcoming: "none" };
const pic = (key: string) => `/marketing/${key}.jpg`;

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  // ------------------------------------------------------------------ any time
  {
    key: "we-miss-you", name: "We miss you", kind: "anytime", date: null, banner: pic("we-miss-you"),
    filters: { lastVisit: "over", days: 60, upcoming: "none" },
    subject: "We miss {pet_name}! 🐾",
    preheader: "Your spa day is just a few taps away.",
    headline: "It's been a while, {first_name}!",
    body: "We've been thinking about {pet_name}! It's been a little while since the last spa day, and regular grooming keeps coats healthy, nails comfy and skin happy.\n\nNo driving, no waiting rooms: our van parks right outside your door, and {pet_name} gets one-on-one attention from start to finish." + sign + "\n\nP.S. Weekday mornings usually have the most openings.",
    button: "Book {pet_name}'s visit",
  },
  {
    key: "spot-waiting", name: "Your spot is waiting", kind: "anytime", date: null, banner: pic("spot-waiting"),
    filters: { lastVisit: "over", days: 90, upcoming: "none" },
    subject: "{pet_name}'s spot is waiting ✂️",
    preheader: "Pick a time that works for you. We bring the spa.",
    headline: "Ready when you are",
    body: "Hi {first_name},\n\nLife gets busy, we get it. That's exactly why we come to you. Pick a time, and we'll pull up with a warm bath, a fresh cut and plenty of treats for {pet_name}.\n\nBooking takes less than a minute, and you'll get a reminder before we arrive." + sign,
    button: "Pick a time",
  },
  {
    key: "signs-time", name: "5 signs it's grooming time", kind: "anytime", date: null, banner: pic("signs-time"),
    filters: { lastVisit: "over", days: 45, upcoming: "none" },
    subject: "5 signs {pet_name} is ready for a groom",
    preheader: "Number 3 surprises most dog parents.",
    headline: "Is it grooming time?",
    body: "Hi {first_name},\n\nNot sure if {pet_name} is due? Here's what we look for:\n\n1. Nails clicking on the floor\n2. Fur growing over the eyes\n3. Little knots behind the ears and under the legs (they turn into mats fast)\n4. That doggy smell is back, even after a bath at home\n5. More scratching than usual\n\nSpotted two or more? It's time! We come to your door, so it's one less thing on your list." + sign,
    button: "Book a groom",
  },
  {
    key: "filling-up", name: "Calendar filling up", kind: "anytime", date: null, banner: pic("filling-up"),
    filters: notBooked,
    subject: "Our calendar is filling up 📅",
    preheader: "Grab your favorite day before it's gone.",
    headline: "Spots are going fast",
    body: "Hi {first_name},\n\nThe next few weeks are filling up quickly, and we'd love to save a spot for {pet_name}.\n\nBook now to get the day and time that fit you best." + sign + "\n\nP.S. Want to never think about it again? Ask us for a repeat visit every 4 to 6 weeks.",
    button: "Save my spot",
  },
  {
    key: "repeat-visits", name: "Set it and forget it", kind: "anytime", date: null, banner: pic("repeat-visits"),
    filters: { lastVisit: "within", days: 365, upcoming: "none" },
    subject: "Never think about grooming again 🔁",
    preheader: "Set it once, and we take care of the rest.",
    headline: "Set it and forget it",
    body: "Hi {first_name},\n\nThe happiest pups we see are on a regular schedule. Every 4 to 6 weeks keeps coats mat-free, nails short, and each groom quick and stress-free.\n\nBook {pet_name}'s next visit and tell us you'd like it to repeat. We'll keep the same day and time, send a reminder before every visit, and you can move one anytime." + sign,
    button: "Book the next one",
  },
  {
    key: "refer-friend", name: "Share the love (referrals)", kind: "anytime", date: null, banner: pic("refer-friend"),
    filters: { lastVisit: "within", days: 365 },
    subject: "Know a pup who'd love a spa day? 🐶",
    preheader: "Small business, big thanks.",
    headline: "Share the love",
    body: "Hi {first_name},\n\nWe're a small local business, and most of our new clients come from people like you. If a friend, neighbor or family member has a pup, we'd be so grateful if you passed our name along.\n\nThey can book online in a minute, and we'll take great care of them, just like we do with {pet_name}.\n\nThank you for being part of the Woofers family!" + sign,
    button: "Our booking page",
  },
  {
    key: "welcome-first", name: "First spa day (new leads)", kind: "anytime", date: null, banner: pic("welcome-first"),
    filters: { lastVisit: "never", upcoming: "none" },
    subject: "Your first spa day is waiting 🛁",
    preheader: "Mobile grooming, right outside your door.",
    headline: "Welcome to Woofers!",
    body: "Hi {first_name},\n\nThanks for your interest in Woofers Dog Spa! Here's how it works: we park our fully equipped van at your home, and your pup gets a calm, one-on-one grooming session. No cages, no long waits, no car rides.\n\nBath, haircut, nails, ears and lots of love, usually in about two hours." + sign,
    button: "Book the first visit",
  },

  // ------------------------------------------------------------------ seasons and holidays
  {
    key: "new-year", name: "New Year", kind: "season", date: (y) => ymd(y, 1, 1), banner: pic("new-year"), filters: notBooked,
    subject: "New year, fresh look for {pet_name} ✨",
    preheader: "Start the year with a clean, happy pup.",
    headline: "Happy New Year!",
    body: "Hi {first_name},\n\nThank you for trusting us with {pet_name} this past year. Start the new one fresh: a bath, a clean cut and a little pampering, right in your driveway.\n\nEarly January fills up fast after the holidays, so book now to get your favorite day." + sign,
    button: "Book now",
  },
  {
    key: "winter-care", name: "Winter coat care", kind: "season", date: (y) => ymd(y, 1, 20), banner: pic("winter-care"), filters: notBooked,
    subject: "Rainy days, muddy paws? 🌧️",
    preheader: "How to keep {pet_name}'s coat mat-free this winter.",
    headline: "Winter coat survival guide",
    body: "Hi {first_name},\n\nWet weather is the number one cause of mats: damp fur tangles fast, especially behind the ears and on the legs.\n\nOur quick tips: towel-dry after every walk, brush the legs and ears twice a week, and keep the hair between the paw pads short so it doesn't hold mud.\n\nWe'll take care of the rest: a full bath, dry and brush-out for {pet_name}, right outside your door. No wet dog in your car!" + sign,
    button: "Book a winter groom",
  },
  {
    key: "valentines", name: "Valentine's Day", kind: "season", date: (y) => ymd(y, 2, 14), banner: pic("valentines"), filters: {},
    subject: "Show {pet_name} some love 💕",
    preheader: "The sweetest gift for your best friend.",
    headline: "Happy Valentine's Day!",
    body: "Hi {first_name},\n\nNobody loves you quite like {pet_name} does. Say thank you with a spa day: a warm bath, a fresh cut and a little extra pampering, all in our van at your door." + sign,
    button: "Book a spa day",
  },
  {
    key: "st-patricks", name: "St. Patrick's Day", kind: "season", date: (y) => ymd(y, 3, 17), banner: pic("st-patricks"), filters: notBooked,
    subject: "Feeling lucky? 🍀",
    preheader: "Shedding season is around the corner.",
    headline: "Happy St. Patrick's Day!",
    body: "Hi {first_name},\n\nWe're lucky to have friends like you and {pet_name}! Spring is around the corner, and so is shedding season.\n\nA de-shedding bath now means less fur on your couch, your clothes and your car for weeks." + sign,
    button: "Book now",
  },
  {
    key: "spring", name: "Spring shedding", kind: "season", date: (y) => ymd(y, 3, 25), banner: pic("spring"), filters: notBooked,
    subject: "Fur everywhere? Spring is here 🌷",
    preheader: "Our de-shedding treatment removes the loose undercoat.",
    headline: "Spring is here!",
    body: "Hi {first_name},\n\nWarmer days mean the winter coat is coming out, usually all over your floor. Our de-shedding treatment gently removes the loose undercoat, so {pet_name} stays cool and your home stays (mostly) fur-free.\n\nSpring is our busiest season, so book early to get the day you want." + sign,
    button: "Book a spring groom",
  },
  {
    key: "easter", name: "Easter", kind: "season", date: easter, banner: pic("easter"), filters: notBooked,
    subject: "Hop in for a fresh groom 🐣",
    preheader: "Picture-ready for the family photos.",
    headline: "Happy Easter!",
    body: "Hi {first_name},\n\nFamily photos coming up? Make sure {pet_name} is camera-ready with a bath, a fresh cut and a cute bandana. Book before the holiday weekend, it's always a busy one." + sign,
    button: "Book now",
  },
  {
    key: "mothers-day", name: "Mother's Day", kind: "season", date: (y) => nthWeekday(y, 5, 0, 2), banner: pic("mothers-day"), filters: {},
    subject: "Happy Mother's Day to all dog moms 💐",
    preheader: "You take care of everyone. Let us take care of {pet_name}.",
    headline: "Happy Mother's Day!",
    body: "Hi {first_name},\n\nTo every mom who loves her fur babies: you deserve a break! Let us take care of {pet_name}'s grooming, right at your door, while you put your feet up.\n\nIt also makes a sweet gift. Know a dog mom? Send her our booking page." + sign,
    button: "Book a visit",
  },
  {
    key: "summer", name: "Summer kickoff", kind: "season", date: (y) => nthWeekday(y, 5, 1, -1), banner: pic("summer"), filters: notBooked,
    subject: "Is {pet_name} summer-ready? ☀️",
    preheader: "Summer spots go fast. Here's how to get one.",
    headline: "Hello, summer!",
    body: "Hi {first_name},\n\nLonger days, beach trips and backyard BBQs are coming. A summer trim and a good de-shed help {pet_name} stay cool and comfortable.\n\nSummer is our busiest time of the year, so the earlier you book, the better your choice of days." + sign,
    button: "Book a summer cut",
  },
  {
    key: "fathers-day", name: "Father's Day", kind: "season", date: (y) => nthWeekday(y, 6, 0, 3), banner: pic("fathers-day"), filters: {},
    subject: "Happy Father's Day to all dog dads 🐶",
    preheader: "For the dad whose best friend has four legs.",
    headline: "Happy Father's Day!",
    body: "Hi {first_name},\n\nHere's to the dog dads! Treat {pet_name} (and yourself) to a fresh groom without the drive. We come to you, so you can enjoy the weekend." + sign,
    button: "Book now",
  },
  {
    key: "july-4th", name: "4th of July", kind: "season", date: (y) => ymd(y, 7, 4), banner: pic("july-4th"), filters: {},
    subject: "Keep {pet_name} calm on the 4th 🎆",
    preheader: "Our 4 tips for a stress-free night.",
    headline: "Happy Independence Day!",
    body: "Hi {first_name},\n\nFireworks are the scariest night of the year for many pups. Our tips:\n\n1. Keep {pet_name} inside, with curtains closed and music or TV on\n2. A long walk in the afternoon helps them rest later\n3. Make sure the ID tag and microchip info are up to date\n4. A cozy spot with a favorite blanket works wonders\n\nAnd for the summer parties, book a fresh groom so they look their best." + sign,
    button: "Book now",
  },
  {
    key: "summer-heat", name: "Beat the heat", kind: "season", date: (y) => ymd(y, 7, 20), banner: pic("summer-heat"), filters: notBooked,
    subject: "Help {pet_name} beat the heat 🌡️",
    preheader: "Why shaving isn't always the answer.",
    headline: "Beat the heat",
    body: "Hi {first_name},\n\nDid you know? Shaving a double-coated dog can make them hotter, not cooler. Their coat works like insulation. What really helps is removing the dead undercoat, so air can move through.\n\nThat's exactly what our de-shedding treatment does. Add a tidy summer trim, and {pet_name} is ready for the hottest days." + sign + "\n\nP.S. Walk early in the morning or after sunset, and check the pavement with your hand first.",
    button: "Book a cool-down groom",
  },
  {
    key: "back-to-routine", name: "Back to routine", kind: "season", date: (y) => ymd(y, 8, 15), banner: pic("back-to-routine"), filters: notBooked,
    subject: "Back to routine (for {pet_name} too) 🎒",
    preheader: "Book now and get the fall schedule you want.",
    headline: "Back to routine",
    body: "Hi {first_name},\n\nSummer is winding down and calendars are filling back up. It's the perfect time to get {pet_name} back on a regular grooming schedule.\n\nBook the next visit now and choose a day that works with your new routine. We'll handle the rest." + sign,
    button: "Book now",
  },
  {
    key: "dog-day", name: "National Dog Day", kind: "season", date: (y) => ymd(y, 8, 26), banner: pic("dog-day"), filters: {},
    subject: "Happy National Dog Day, {pet_name}! 🐕",
    preheader: "Today is all about our best friends.",
    headline: "Happy National Dog Day!",
    body: "Hi {first_name},\n\nToday is all about our best friends, and {pet_name} is one of our favorites! Celebrate with a spa day: bath, cut, nails and lots of love.\n\nThank you for letting us be part of {pet_name}'s life." + sign,
    button: "Book a spa day",
  },
  {
    key: "fall", name: "Fall coat change", kind: "season", date: (y) => nthWeekday(y, 9, 1, 1), banner: pic("fall"), filters: notBooked,
    subject: "Fall coat change is here 🍂",
    preheader: "Out with the summer coat, in with the cozy one.",
    headline: "Hello, fall!",
    body: "Hi {first_name},\n\nThe seasons are changing and so are coats. A fall groom clears out the summer undercoat and gets {pet_name} ready for cooler, wetter days.\n\nThe holidays are closer than they look, too. Book now and you'll have your pick of days." + sign,
    button: "Book now",
  },
  {
    key: "halloween", name: "Halloween", kind: "season", date: (y) => ymd(y, 10, 31), banner: pic("halloween"), filters: notBooked,
    subject: "No tricks, just treats for {pet_name} 🎃",
    preheader: "Costume-ready in one visit.",
    headline: "Happy Halloween!",
    body: "Hi {first_name},\n\nWhether {pet_name} is dressing up as a pumpkin or a superhero, a fresh groom makes every costume look better. Book before the spooky weekend!" + sign + "\n\nP.S. Keep the candy bowl up high: chocolate and xylitol are toxic for dogs.",
    button: "Book now",
  },
  {
    key: "holiday-booking", name: "Holiday spots open", kind: "season", date: (y) => ymd(y, 11, 5), banner: pic("holiday-booking"), filters: notBooked,
    subject: "Holiday grooming spots are open 🎁",
    preheader: "Thanksgiving and December weeks book up first.",
    headline: "Book your holiday groom",
    body: "Hi {first_name},\n\nEvery year, the weeks before Thanksgiving and Christmas are the first to fill up. We're opening them now so our regular clients get first pick.\n\nChoose a day close to the holiday, and {pet_name} will be fresh and fluffy when the family arrives." + sign,
    button: "Get a holiday spot",
  },
  {
    key: "thanksgiving", name: "Thanksgiving", kind: "season", date: (y) => nthWeekday(y, 11, 4, 4), banner: pic("thanksgiving"), filters: {},
    subject: "Thankful for you and {pet_name} 🦃",
    preheader: "A little thank-you from our van to your home.",
    headline: "Happy Thanksgiving!",
    body: "Hi {first_name},\n\nThis year we're thankful for clients like you, who welcome us into your driveway and trust us with your family.\n\nA quick tip for the big dinner: no turkey bones, onions, grapes or stuffing for {pet_name}. A little plain turkey is fine!" + sign,
    button: "Book a visit",
  },
  {
    key: "holiday-photos", name: "Holiday photos", kind: "season", date: (y) => ymd(y, 12, 5), banner: pic("holiday-photos"), filters: notBooked,
    subject: "Picture-perfect for the holidays 📸",
    preheader: "Card photos, family visits, cozy nights.",
    headline: "Ready for the holiday photos?",
    body: "Hi {first_name},\n\nHoliday cards, family visits, cozy nights by the tree: {pet_name} deserves to look and feel their best.\n\nOur December days are filling up fast, so book now to get a spot before the holidays." + sign,
    button: "Book before the holidays",
  },
  {
    key: "holidays", name: "Happy Holidays", kind: "season", date: (y) => ymd(y, 12, 20), banner: pic("holidays"), filters: {},
    subject: "Happy Holidays from all of us 🎄",
    preheader: "Thank you for a wonderful year.",
    headline: "Happy Holidays!",
    body: "Hi {first_name},\n\nThank you for a wonderful year! It's been a joy to pamper {pet_name}, and we can't wait to see you again in the new year.\n\nWishing you a cozy, happy holiday season, full of treats and belly rubs." + sign,
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
