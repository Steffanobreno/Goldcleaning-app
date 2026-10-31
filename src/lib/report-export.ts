import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { report } from "./data/reports";
import type { reportDetails } from "./data/report-details";
import { money } from "./format";
import { methodLabel } from "./payment-methods";

// Reports as a file: a PDF to print or send to the accountant, and a CSV that opens in Excel.
// Both carry the same thing: the summary, the money (discounts, tax, tips, unpaid), by
// day/week/month, by payment method, by service, by cleaner, top clients, and every payment and
// every visit of the period.

export type ReportFile = {
  business: string;
  from: string;
  to: string;
  group: "day" | "week" | "month";
  r: Awaited<ReturnType<typeof report>>;
  d: Awaited<ReturnType<typeof reportDetails>>;
};

const STATUS: Record<string, string> = {
  requested: "Request", unconfirmed: "Booked", confirmed: "Confirmed", en_route: "On the way",
  in_progress: "Cleaning", completed: "Finished", cancelled: "Cancelled", no_show: "No-show",
};
const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => utc(d).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
const bucketLabel = (d: string, g: ReportFile["group"]) =>
  g === "day" ? fmt(d, { weekday: "short", month: "short", day: "numeric" })
    : g === "week" ? `Week of ${fmt(d, { month: "short", day: "numeric" })}`
      : fmt(d, { month: "long", year: "numeric" });
const rangeLabel = (from: string, to: string) =>
  from === to ? fmt(from, { month: "short", day: "numeric", year: "numeric" })
    : `${fmt(from, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(to, { month: "short", day: "numeric", year: "numeric" })}`;
const time12 = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`;
};
const visitPayment = (v: ReportFile["d"]["visits"][number]) =>
  v.invoice === "closed" ? "Paid" : v.status === "completed" ? "Unpaid" : "—";

type Table = { title: string; head: string[]; rows: string[][]; foot?: string[] };

/** Every section as a table of plain text, money formatted for people (the PDF). */
function tables(f: ReportFile, cell: (cents: number) => string): Table[] {
  const { r, d } = f;
  const avg = r.appts ? Math.round(r.expected / r.appts) : 0;
  const sum = <T,>(xs: T[], g: (x: T) => number) => xs.reduce((s, x) => s + g(x), 0);
  return [
    {
      title: "Summary",
      head: ["Item", "Value"],
      rows: [
        ["Collected (with tips)", cell(r.collected + r.tips)],
        ["Collected (without tips)", cell(r.collected)],
        ["Tips", cell(r.tips)],
        ["Payments received", String(r.paymentsCount)],
        ["Expected (services booked)", cell(r.expected)],
        ["Unpaid (finished, not checked out)", cell(r.unpaid)],
        ["Checkouts closed", String(d.checkouts.count)],
        ["Checkouts: services subtotal", cell(d.checkouts.subtotal)],
        ["Checkouts: discounts", cell(d.checkouts.discount)],
        ["Checkouts: tax", cell(d.checkouts.tax)],
        ["Checkouts: tips", cell(d.checkouts.tips)],
        ["Checkouts: total", cell(d.checkouts.total)],
        ["Average visit (expected)", cell(avg)],
        ["Appointments booked", String(r.appts)],
        ["Appointments finished", String(r.finished)],
        ["Cancelled", String(r.cancelled)],
        ["No-show", String(r.no_show)],
                ["Clients", String(r.clients)],
        ["New clients", String(r.newClients)],
      ],
    },
    {
      title: `By ${f.group}`,
      head: [f.group[0].toUpperCase() + f.group.slice(1), "Visits", "Expected", "Collected"],
      rows: r.buckets.map((b) => [bucketLabel(b.bucket, f.group), String(b.appts), cell(b.expected), cell(b.collected)]),
      foot: ["Total", String(sum(r.buckets, (b) => b.appts)),
        cell(sum(r.buckets, (b) => b.expected)), cell(sum(r.buckets, (b) => b.collected))],
    },
    {
      title: "By payment method",
      head: ["Method", "Amount", "Tips", "Total"],
      rows: r.methods.map((m) => [methodLabel(m.method), cell(m.amount), cell(m.tips), cell(m.amount + m.tips)]),
      foot: ["Total", cell(sum(r.methods, (m) => m.amount)), cell(sum(r.methods, (m) => m.tips)), cell(sum(r.methods, (m) => m.amount + m.tips))],
    },
    {
      title: "By cleaner",
      head: ["Cleaner", "Visits", "Expected", "Collected", "Tips"],
      rows: d.groomers.map((g) => [g.name, String(g.visits), cell(g.expected), cell(g.collected), cell(g.tips)]),
    },
    {
      title: "By service",
      head: ["Service", "Times", "Revenue"],
      rows: r.services.map((s) => [s.name, String(s.count), cell(s.revenue)]),
    },
    {
      title: "Top clients by spending",
      head: ["Client", "Visits", "Spent"],
      rows: r.topClients.map((c) => [c.name, String(c.visits), cell(c.spent)]),
    },
    {
      title: "Payments",
      head: ["Received", "Receipt", "Client", "Visit", "Method", "Reference", "Amount", "Tip", "Total"],
      rows: d.payments.map((p) => [p.received, p.receipt_no ? `#${p.receipt_no}` : "", p.client, p.visit ?? "", methodLabel(p.method),
        p.reference ?? "", cell(p.amount), cell(p.tip), cell(p.amount + p.tip)]),
      foot: ["Total", "", "", "", "", "", cell(sum(d.payments, (p) => p.amount)), cell(sum(d.payments, (p) => p.tip)),
        cell(sum(d.payments, (p) => p.amount + p.tip))],
    },
    {
      title: "Visits",
      head: ["Date", "Time", "Client", "City", "Services", "Cleaner", "Status", "Price", "Payment"],
      rows: d.visits.map((v) => [v.date, time12(v.time), v.client, v.city ?? "", v.services, v.groomer,
        STATUS[v.status] ?? v.status, cell(v.price), visitPayment(v)]),
    },
  ];
}

// ---------- CSV ----------

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** One CSV with a block per section (Excel opens it as one sheet); money as plain numbers. */
export function reportCsv(f: ReportFile) {
  const lines: string[] = [];
  const add = (cells: string[]) => lines.push(cells.map(csvCell).join(","));
  add([`${f.business} — Report`]);
  add(["Period", f.from, f.to]);
  for (const t of tables(f, (c) => (c / 100).toFixed(2))) {
    lines.push("");
    add([t.title]);
    add(t.head);
    for (const r of t.rows) add(r);
    if (t.foot) add(t.foot);
  }
  // A byte-order mark so Excel reads accents and the dash correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ---------- PDF ----------

const NAVY = rgb(0.043, 0.122, 0.227);
const GOLD = rgb(0.776, 0.643, 0.369);
const MUTED = rgb(0.365, 0.42, 0.502);
const LINE = rgb(0.882, 0.902, 0.933);
const STRIPE = rgb(0.965, 0.973, 0.984);
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const safe = (s: string) =>
  [...s.normalize("NFC")].map((ch) => (ch.charCodeAt(0) < 256 || CP1252_EXTRA.includes(ch) ? ch : "?")).join("");

// Column widths (share of the line) and which columns are numbers (right-aligned), per section.
type Layout = { widths: number[]; numeric: number[]; size?: number; landscape?: boolean };
const LAYOUT: Record<string, Layout> = {
  Summary: { widths: [0.7, 0.3], numeric: [1] },
  "By payment method": { widths: [0.4, 0.2, 0.2, 0.2], numeric: [1, 2, 3] },
  "By cleaner": { widths: [0.36, 0.14, 0.18, 0.18, 0.14], numeric: [1, 2, 3, 4] },
  "By service": { widths: [0.62, 0.14, 0.24], numeric: [1, 2] },
  "Top clients by spending": { widths: [0.62, 0.14, 0.24], numeric: [1, 2] },
  Payments: { widths: [0.13, 0.07, 0.17, 0.1, 0.09, 0.14, 0.1, 0.09, 0.11], numeric: [6, 7, 8], size: 7.5, landscape: true },
  Visits: { widths: [0.09, 0.08, 0.15, 0.1, 0.3, 0.1, 0.08, 0.06, 0.04], numeric: [7], size: 7, landscape: true },
};
const bucketLayout: Layout = { widths: [0.4, 0.15, 0.225, 0.225], numeric: [1, 2, 3] };

export async function reportPdf(f: ReportFile) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${f.business} report ${f.from} to ${f.to}`);
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const M = 40;
  let page = undefined as unknown as PDFPage;
  let W = 612;
  let H = 792;
  let y = 0;

  const text = (s: string, x: number, size: number, font: PDFFont, color = NAVY) =>
    page.drawText(safe(s), { x, y, size, font, color });
  const fit = (s: string, width: number, size: number, font: PDFFont) => {
    let t = safe(s);
    if (font.widthOfTextAtSize(t, size) <= width) return t;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > width) t = t.slice(0, -1);
    return `${t}…`;
  };
  const newPage = (landscape: boolean) => {
    [W, H] = landscape ? [792, 612] : [612, 792];
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 54, width: W, height: 54, color: NAVY });
    page.drawRectangle({ x: 0, y: H - 57, width: W, height: 3, color: GOLD });
    y = H - 34;
    text(f.business, M, 15, fonts.bold, rgb(1, 1, 1));
    const sub = `Report · ${rangeLabel(f.from, f.to)}`;
    text(sub, W - M - fonts.regular.widthOfTextAtSize(safe(sub), 10), 10, fonts.regular, rgb(1, 1, 1));
    y = H - 84;
  };

  let landscape: boolean | null = null;
  for (const t of tables(f, money)) {
    const lay: Layout = t.title.startsWith("By ") && !LAYOUT[t.title] ? bucketLayout : LAYOUT[t.title];
    const size = lay.size ?? 9.5;
    const rowH = size + 8;
    const wantLandscape = !!lay.landscape;
    // The detail tables start on their own (landscape) page; the short ones follow each other.
    if (landscape === null || wantLandscape !== landscape || wantLandscape || y < M + rowH * 4) {
      newPage(wantLandscape);
      landscape = wantLandscape;
    }
    const width = W - 2 * M;
    const xs = lay.widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? M) + w * width], [M]);
    const drawRow = (cells: string[], font: PDFFont, color = NAVY, fill?: ReturnType<typeof rgb>) => {
      if (y < M + rowH) {
        newPage(wantLandscape);
        drawRow(t.head, fonts.bold, MUTED);
      }
      if (fill) page.drawRectangle({ x: M, y: y - 4, width, height: rowH, color: fill });
      cells.forEach((c, i) => {
        const w = (xs[i + 1] - xs[i]) - 6;
        const s = fit(c, w, size, font);
        const x = lay.numeric.includes(i) ? xs[i + 1] - 3 - font.widthOfTextAtSize(s, size) : xs[i] + 3;
        page.drawText(s, { x, y, size, font, color });
      });
      y -= rowH;
    };
    y -= 4;
    text(t.title, M, 13, fonts.bold);
    y -= 20;
    drawRow(t.head, fonts.bold, MUTED);
    page.drawLine({ start: { x: M, y: y + rowH - 4 }, end: { x: M + width, y: y + rowH - 4 }, thickness: 0.8, color: LINE });
    if (t.rows.length === 0) {
      text("Nothing in this period.", M + 3, size, fonts.regular, MUTED);
      y -= rowH;
    }
    t.rows.forEach((r, i) => drawRow(r, fonts.regular, NAVY, i % 2 ? STRIPE : undefined));
    if (t.foot && t.rows.length) {
      page.drawLine({ start: { x: M, y: y + rowH - 4 }, end: { x: M + width, y: y + rowH - 4 }, thickness: 0.8, color: NAVY });
      drawRow(t.foot, fonts.bold);
    }
    y -= 18;
  }
  // Page numbers.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const s = `Page ${i + 1} of ${pages.length}`;
    p.drawText(s, { x: p.getWidth() - M - fonts.regular.widthOfTextAtSize(s, 8), y: 20, size: 8, font: fonts.regular, color: MUTED });
  });
  return doc.save();
}
