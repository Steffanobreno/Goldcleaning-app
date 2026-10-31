import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatInTimeZone } from "date-fns-tz";
import type { Receipt } from "./data/receipts";
import { money } from "./format";
import { RECEIPT_LOGO_PNG_BASE64 } from "./receipt-logo";

// Receipts as a PDF, one per page (US Letter): logo, business, receipt number, client, times,
// services by pet, totals and payments. Built here on the server with pdf-lib.

const NAVY = rgb(0.075, 0.125, 0.224);
const MUTED = rgb(0.365, 0.42, 0.502);
const LINE = rgb(0.882, 0.902, 0.933);
const GREEN = rgb(0.086, 0.5, 0.24);
const W = 612;
const H = 792;
const LEFT = 116;
const RIGHT = W - 116;

// The standard PDF fonts know Western characters only (Windows-1252); anything else becomes "?".
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const safe = (s: string) =>
  [...s.normalize("NFC")].map((ch) => (ch.charCodeAt(0) < 256 || CP1252_EXTRA.includes(ch) ? ch : "?")).join("");

type Fonts = { regular: PDFFont; bold: PDFFont };

function draw(page: PDFPage, fonts: Fonts, logo: PDFImage, r: Receipt) {
  const tz = r.business.timezone;
  const when = (d: Date | null) => (d ? formatInTimeZone(d, tz, "EEE, MMM d, yyyy h:mm a") : "—");
  let y = H - 56;
  const text = (s: string, x: number, size = 11, font = fonts.regular, color = NAVY) =>
    page.drawText(safe(s), { x, y, size, font, color });
  const center = (s: string, size = 11, font = fonts.regular, color = NAVY) => {
    const w = font.widthOfTextAtSize(safe(s), size);
    text(s, (W - w) / 2, size, font, color);
  };
  const right = (s: string, size = 11, font = fonts.regular, color = NAVY) => {
    const w = font.widthOfTextAtSize(safe(s), size);
    text(s, RIGHT - w, size, font, color);
  };
  const row = (label: string, value: string, opts: { bold?: boolean; color?: typeof NAVY; size?: number } = {}) => {
    const f = opts.bold ? fonts.bold : fonts.regular;
    // Long service names wrap so they never run into the price.
    const words = safe(label).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const wd of words) {
      const next = cur ? `${cur} ${wd}` : wd;
      if (f.widthOfTextAtSize(next, opts.size ?? 11) > RIGHT - LEFT - 90 && cur) {
        lines.push(cur);
        cur = wd;
      } else cur = next;
    }
    lines.push(cur);
    lines.forEach((l, i) => {
      text(l, LEFT, opts.size ?? 11, f, opts.color ?? NAVY);
      if (i === 0) right(value, opts.size ?? 11, f, opts.color ?? NAVY);
      y -= (opts.size ?? 11) + 6;
    });
  };
  const rule = () => {
    page.drawLine({ start: { x: LEFT, y: y + 6 }, end: { x: RIGHT, y: y + 6 }, thickness: 1, color: LINE });
    y -= 12;
  };

  // Fit the logo in an 80×76 box, keeping its shape.
  const scale = Math.min(80 / logo.width, 76 / logo.height);
  const lw = logo.width * scale, lh = logo.height * scale;
  page.drawImage(logo, { x: (W - lw) / 2, y: y - 76 + (76 - lh) / 2, width: lw, height: lh });
  y -= 96;
  center(r.business.name, 15, fonts.bold);
  y -= 16;
  const contact = [r.business.phone ? r.business.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : null, r.business.address]
    .filter(Boolean).join("  ·  ");
  if (contact) {
    center(contact, 9, fonts.regular, MUTED);
    y -= 26;
  } else y -= 10;

  center(`Receipt #${r.number}`, 18, fonts.bold);
  y -= 18;
  center(r.open ? "BALANCE DUE" : "PAID · THANK YOU", 10, fonts.bold, r.open ? rgb(0.73, 0.15, 0.15) : GREEN);
  y -= 26;

  rule();
  row("Client", r.client.name, { bold: true });
  row("Date", formatInTimeZone(r.date, tz, "EEEE, MMMM d, yyyy"));
  row("Checked in", when(r.checkedIn));
  row("Checked out", when(r.checkedOut));
  y -= 4;
  rule();

  if (r.home) {
    text("Cleaning at", LEFT, 9, fonts.regular, MUTED);
    y -= 14;
    text(r.home, LEFT, 11, fonts.bold);
    y -= 20;
  }
  for (const l of r.lines) row(l.name, money(l.cents));
  y -= 4;
  for (const a of r.adjustments) row(a.label, money(a.cents), { color: a.kind === "discount" ? GREEN : NAVY });
  rule();

  row("Subtotal", money(r.subtotal));
  if (r.discount > 0) row("Discount", `-${money(r.discount)}`, { color: GREEN });
  if (r.tax > 0) row("Tax", money(r.tax));
  row("Tips", money(r.tips));
  row("Total", money(r.total), { bold: true, size: 13 });
  row("Total paid", money(r.paid), { bold: true });
  if (r.total > r.paid) row("Balance due", money(r.total - r.paid), { bold: true, color: rgb(0.73, 0.15, 0.15) });
  y -= 4;

  if (r.payments.length) {
    rule();
    text("Payments", LEFT, 11, fonts.bold);
    y -= 17;
    for (const p of r.payments) {
      const tip = p.tip ? ` (incl. ${money(p.tip)} tip)` : "";
      row(`${p.method} · ${formatInTimeZone(p.at, tz, "MMM d, h:mm a")}${tip}`, money(p.amount + p.tip), { size: 10 });
    }
  }

  y = 64;
  center(`Thank you for choosing ${r.business.name}!`, 10, fonts.bold);
  y -= 14;
  center(r.business.phone ? `Questions? Call or text ${contact.split("  ·  ")[0]}` : "", 9, fonts.regular, MUTED);
}

/** A PDF with one page per receipt. */
export async function receiptsPdf(receipts: Receipt[], title = "Receipts"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(title));
  doc.setCreator("Peninsula Gold Cleaning");
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const logo = await doc.embedPng(Buffer.from(RECEIPT_LOGO_PNG_BASE64, "base64"));
  for (const r of receipts) draw(doc.addPage([W, H]), fonts, logo, r);
  if (receipts.length === 0) {
    const page = doc.addPage([W, H]);
    page.drawText("No receipts in this period.", { x: LEFT, y: H - 120, size: 14, font: fonts.regular, color: MUTED });
  }
  return doc.save();
}
