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
