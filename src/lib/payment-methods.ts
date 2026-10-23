// Shared by server and client code (no "server-only" here).
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "check", label: "Check" },
  { value: "bitcoin", label: "Bitcoin" },
  { value: "other", label: "Other" },
] as const;

export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
