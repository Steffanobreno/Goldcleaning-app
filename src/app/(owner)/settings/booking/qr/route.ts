import QRCode from "qrcode";
import { getStaff } from "@/lib/auth";

// The booking page's QR code as a PNG, to save, print or share. ?download names the file.
export async function GET(request: Request) {
  const staff = await getStaff();
  if (!staff) return new Response("Not logged in", { status: 401 });
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const png = await QRCode.toBuffer(`${appUrl}/book`, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
  const headers: Record<string, string> = { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" };
  if (new URL(request.url).searchParams.has("download")) headers["Content-Disposition"] = 'attachment; filename="booking-qr-code.png"';
  return new Response(new Uint8Array(png), { headers });
}
