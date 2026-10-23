// Flat-rate cleaning prices. Pure: used by the booking page (live total), the owner's
// appointment form and the server, which recomputes the price before saving a booking.
//
// price = start (1 bedroom / 1 bathroom)
//       + (bedrooms − 1) × per bedroom + (full baths − 1) × per full bath + half baths × per half bath
//       + extras (flat, × quantity)
// A studio (0 bedrooms) is priced as 1 bedroom.

export type Frequency = "one_time" | "weekly" | "biweekly" | "every_4_weeks";

export const FREQUENCIES: Frequency[] = ["one_time", "weekly", "biweekly", "every_4_weeks"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  every_4_weeks: "Every 4 weeks",
};

export type Rate = { startCents: number; bedroomCents: number; fullBathCents: number; halfBathCents: number };
export type HomeSize = { bedrooms: number; fullBaths: number; halfBaths: number };
export type ExtraPick = { serviceId: string; name: string; unitCents: number; qty: number };
export type PriceLine = {
  kind: "service" | "room" | "extra";
  serviceId: string | null;
  label: string;
  qty: number;
  unitCents: number;
  amountCents: number;
};

const line = (kind: PriceLine["kind"], serviceId: string | null, label: string, qty: number, unitCents: number): PriceLine => ({
  kind,
  serviceId,
  label,
  qty,
  unitCents,
  amountCents: qty * unitCents,
});

export function priceLines(
  service: { id: string; name: string },
  frequency: Frequency,
  rate: Rate,
  home: HomeSize,
  extras: ExtraPick[],
): PriceLine[] {
  const extraBedrooms = Math.max(home.bedrooms, 1) - 1;
  const extraFullBaths = Math.max(home.fullBaths, 1) - 1;
  const halfBaths = Math.max(home.halfBaths, 0);

  const lines = [line("service", service.id, `${service.name} · ${FREQUENCY_LABEL[frequency]}`, 1, rate.startCents)];
  if (extraBedrooms) lines.push(line("room", null, "Extra bedroom", extraBedrooms, rate.bedroomCents));
  if (extraFullBaths) lines.push(line("room", null, "Extra full bath", extraFullBaths, rate.fullBathCents));
  if (halfBaths) lines.push(line("room", null, "Half bath", halfBaths, rate.halfBathCents));
  for (const e of extras) {
    if (e.qty > 0) lines.push(line("extra", e.serviceId, e.name, e.qty, e.unitCents));
  }
  return lines;
}

export const totalCents = (lines: PriceLine[]) => lines.reduce((sum, l) => sum + l.amountCents, 0);

/** Visit length: the base time, plus extra time for homes with more than `largeHomeBedrooms`. */
export function durationMinutes(
  home: HomeSize,
  rule: { baseMin: number; largeHomeBedrooms: number; largeHomeExtraMin: number },
) {
  return home.bedrooms > rule.largeHomeBedrooms ? rule.baseMin + rule.largeHomeExtraMin : rule.baseMin;
}

// ---------------------------------------------------------------- catalog and quote

export type DurationRule = { baseMin: number; largeHomeBedrooms: number; largeHomeExtraMin: number };
export type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  pricing: "rate" | "quote"; // "quote": no online price (Airbnb, Office)
  recurring: boolean;
  rates: Partial<Record<Frequency, Rate>>;
};
export type CatalogExtra = { id: string; name: string; unitCents: number; perUnit: boolean; icon: string | null };
export type Catalog = { services: CatalogService[]; extras: CatalogExtra[]; rule: DurationRule };

export type QuoteInput = { serviceId: string; frequency: Frequency; home: HomeSize; extras: { serviceId: string; qty: number }[] };
export type Quote = { service: CatalogService; lines: PriceLine[]; totalCents: number; durationMin: number };

export const MAX_EXTRA_QTY = 20;
const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** Prices a booking against the catalog, or says why it can't be priced online. */
export function quote(cat: Catalog, input: QuoteInput): Quote | { error: string } {
  const service = cat.services.find((s) => s.id === input.serviceId);
  if (!service) return { error: "Please choose a service." };
  if (service.pricing !== "rate") return { error: `${service.name} is priced by quote.` };
  const rate = service.rates[input.frequency];
  if (!rate) return { error: `${service.name} isn't offered ${FREQUENCY_LABEL[input.frequency].toLowerCase()}.` };
  const { bedrooms, fullBaths, halfBaths } = input.home;
  if (!inRange(bedrooms, 0, 7) || !inRange(fullBaths, 1, 7) || !inRange(halfBaths, 0, 7)) {
    return { error: "Please check the number of bedrooms and bathrooms." };
  }
  const picks: ExtraPick[] = [];
  for (const e of input.extras) {
    const extra = cat.extras.find((x) => x.id === e.serviceId);
    if (!extra) return { error: "One of the extras is no longer offered. Please reload the page." };
    const qty = extra.perUnit ? Math.min(Math.max(Math.trunc(e.qty), 0), MAX_EXTRA_QTY) : e.qty > 0 ? 1 : 0;
    picks.push({ serviceId: extra.id, name: extra.name, unitCents: extra.unitCents, qty });
  }
  const lines = priceLines(service, input.frequency, rate, input.home, picks);
  return { service, lines, totalCents: totalCents(lines), durationMin: durationMinutes(input.home, cat.rule) };
}

/**
 * A visit at a price agreed by hand (Airbnb, office, or any service the owner prices herself):
 * one service line at that price. The length still comes from the home size.
 */
export function agreedQuote(cat: Catalog, input: Omit<QuoteInput, "extras">, cents: number): Quote | { error: string } {
  const service = cat.services.find((s) => s.id === input.serviceId);
  if (!service) return { error: "Please choose a service." };
  if (!Number.isInteger(cents) || cents <= 0 || cents > 10_000_00) return { error: "Enter the agreed price." };
  const { bedrooms, fullBaths, halfBaths } = input.home;
  if (!inRange(bedrooms, 0, 7) || !inRange(fullBaths, 1, 7) || !inRange(halfBaths, 0, 7)) {
    return { error: "Please check the number of bedrooms and bathrooms." };
  }
  const lines = [line("service", service.id, `${service.name} · ${FREQUENCY_LABEL[input.frequency]}`, 1, cents)];
  return { service, lines, totalCents: cents, durationMin: durationMinutes(input.home, cat.rule) };
}
