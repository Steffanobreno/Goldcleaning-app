// Reads the client export of the old app (one row per client, pets as "Name(Breed),Name(Breed)").
// Pure parsing, no database, so the import page and the command-line script share it.

export type ImportedPet = { name: string; breed: string | null };
export type ImportedClient = {
  row: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string; // E.164
  addressLine: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  notes: string[];
  marketing: boolean;
  pets: ImportedPet[];
  frequencyDays: number | null;
  lastService: { date: string; start: string } | null; // local business time
  next: { date: string; start: string; end: string } | null; // local business time
  upcomingCount: number;
  totalSalesCents: number | null;
};

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// The export pads values with tabs and non-breaking spaces.
const clean = (v: string | undefined) => (v ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** "Teddy(Miniature Poodle),Jax(Labradoodle (h))" → pets; commas inside parentheses are kept. */
export function parsePets(text: string): ImportedPet[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts
    .map((p) => clean(p))
    .filter(Boolean)
    .map((p) => {
      const open = p.indexOf("(");
      if (open < 0) return { name: p, breed: null };
      const name = clean(p.slice(0, open));
      const breed = clean(p.slice(open + 1, p.endsWith(")") ? -1 : undefined));
      return { name: name || p, breed: breed || null };
    });
}

/** "70 Peninsula Rd, Belvedere, CA, US, 94920" → parts. */
export function parseAddress(text: string) {
  const parts = clean(text).split(",").map((p) => p.trim()).filter(Boolean);
  let zip: string | null = null;
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) zip = parts.pop()!.slice(0, 5);
  if (parts.length && /^(US|USA|United States)$/i.test(parts[parts.length - 1])) parts.pop();
  let state = "CA";
  if (parts.length && /^[A-Z]{2}$/.test(parts[parts.length - 1])) state = parts.pop()!;
  const city = parts.length > 1 ? parts.pop()! : null;
  return { addressLine: parts.join(", ") || null, city, state, zip };
}

function phoneE164(text: string) {
  const d = text.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

/** "2026-10-21 19:00-22:00" → { date, start, end }. */
function parseSlot(text: string) {
  const m = clean(text).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?:-(\d{2}:\d{2}))?$/);
  return m ? { date: m[1], start: m[2], end: m[3] ?? m[2] } : null;
}

export function parseClientsCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { clients: [] as ImportedClient[], problems: ["The file has no rows."] };
  const header = rows[0].map((h) => clean(h).toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    first: col("first name"),
    last: col("last name"),
    email: col("email"),
    phone: col("primary contact", "phone", "mobile"),
    address: col("address"),
    pets: col("pet(breed)", "pets"),
    sales: col("total sales"),
    lastService: col("last service"),
    next: col("next service"),
    notes: col("notes"),
    marketing: col("has subscribed marketing email"),
    upcoming: col("upcoming booking number"),
    tags: col("tags"),
    frequency: col("preferred frequency (days)"),
    latlng: col("latitude, longitude of the address"),
  };
  if (idx.first < 0 || idx.phone < 0) {
    return { clients: [], problems: ['This file needs at least the columns "First name" and "Primary contact".'] };
  }

  const clients: ImportedClient[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const get = (j: number) => (j >= 0 ? clean(r[j]) : "");
    const firstName = get(idx.first);
    const phone = phoneE164(get(idx.phone));
    if (!firstName) return problems.push(`Row ${row}: no first name, skipped.`);
    if (!phone) return problems.push(`Row ${row} (${firstName}): phone "${get(idx.phone)}" is not a US number, skipped.`);
    if (seen.has(phone)) return problems.push(`Row ${row} (${firstName}): same phone as an earlier row, skipped.`);
    seen.add(phone);

    const [lat, lng] = get(idx.latlng).split(",").map((x) => Number(x.trim()));
    const sales = Number(get(idx.sales).replace(/[$,]/g, ""));
    const freq = Number(get(idx.frequency));
    const last = parseSlot(get(idx.lastService));
    const notes = [get(idx.notes), get(idx.tags) && `Tags: ${get(idx.tags)}`].filter(Boolean);
    clients.push({
      row,
      firstName,
      lastName: get(idx.last),
      email: /^\S+@\S+\.\S+$/.test(get(idx.email)) ? get(idx.email).toLowerCase() : null,
      phone,
      ...parseAddress(get(idx.address)),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      notes,
      marketing: /^yes$/i.test(get(idx.marketing)),
      pets: parsePets(get(idx.pets)),
      frequencyDays: Number.isInteger(freq) && freq >= 7 && freq <= 365 ? freq : null,
      lastService: last ? { date: last.date, start: last.start } : null,
      next: parseSlot(get(idx.next)),
      upcomingCount: Number(get(idx.upcoming)) || 0,
      totalSalesCents: Number.isFinite(sales) && get(idx.sales) ? Math.round(sales * 100) : null,
    });
  });
  return { clients, problems };
}
