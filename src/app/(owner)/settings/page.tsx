import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { Page, PageHeader } from "@/components/ui";
import { SettingsList, type SettingsGroup } from "./settings-list";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: SettingsGroup[] = [
  {
    title: "Basic settings",
    links: [
      { href: "/settings/account", title: "Account", text: "Your name, login email, password, app lock (PIN) and devices" },
      { href: "/settings/business", title: "Business", text: "Name, phone, address, links and booking link" },
      { href: "/settings/hours", title: "Working hours", text: "Days and hours you take appointments" },
      { href: "/settings/closed", title: "Closed dates and holidays", text: "Vacations and holidays with no bookings" },
      { href: "/settings/services", title: "Price list", text: "Cleanings, prices per frequency and extras" },
      { href: "/settings/discounts", title: "Discounts", text: "Coupon codes, first-time discounts and discounts for a client or one cleaning" },
      { href: "/settings/team", title: "Team", text: "Cleaning teams, their colors and who does each cleaning" },
    ],
  },
  {
    title: "Clients",
    links: [
      { href: "/settings/lists", title: "Client lists", text: "Tags (VIP, great tipper…) and where clients found you" },
      { href: "/settings/import", title: "Import and export clients", text: "Bring in your client list, or download a backup (CSV)" },
      { href: "/settings/agreement", title: "Service agreement", text: "The terms clients sign" },
    ],
  },
  {
    title: "Calendar",
    links: [{ href: "/settings/calendar", title: "Google Calendar", text: "See every visit in your Google Calendar" }],
  },
  {
    title: "Communication",
    links: [
      { href: "/settings/messages", title: "Email messages", text: "Gmail, reminders, arrival window, receipts and the words of each email" },
      { href: "/settings/notifications", title: "Notifications", text: "Pop-ups on your phone for new bookings, cancellations and reschedules" },
    ],
  },
  {
    title: "Online booking",
    links: [
      { href: "/settings/booking", title: "Online booking", text: "Booking page, QR code, auto-accept, cities, notice and days ahead" },
      { href: "/requests", title: "Booking requests", text: "Accept or decline online requests" },
    ],
  },
  {
    title: "Safety",
    links: [{ href: "/settings/backups", title: "Backups", text: "A weekly copy of everything on your Google Drive" }],
  },
];

export default async function SettingsPage() {
  const staff = await requireStaff();
  return (
    <>
      <PageHeader title="Settings" />
      <Page>
        <p className="text-sm text-muted">
          {staff.businessName} · logged in as {staff.staffName}
        </p>
        <SettingsList groups={GROUPS} />
      </Page>
    </>
  );
}
