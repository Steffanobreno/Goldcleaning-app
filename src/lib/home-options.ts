// Home fields shared by the owner app and the booking page (no server imports here).

export const ACCESS_METHODS = [
  { value: "home", label: "Someone will be home" },
  { value: "key", label: "Key left for us" },
  { value: "lockbox", label: "Lockbox" },
  { value: "door_code", label: "Door / gate code" },
] as const;
export type AccessMethod = (typeof ACCESS_METHODS)[number]["value"];
export const accessLabel = (m: string | null) => ACCESS_METHODS.find((a) => a.value === m)?.label ?? null;

/** "3 bd / 2 ba / 1 half" (a studio shows as "Studio"). */
export function homeSizeLabel(h: { bedrooms: number; full_baths: number; half_baths: number }) {
  const bd = h.bedrooms === 0 ? "Studio" : `${h.bedrooms} bd`;
  return [bd, `${h.full_baths} ba`, h.half_baths ? `${h.half_baths} half` : ""].filter(Boolean).join(" / ");
}
