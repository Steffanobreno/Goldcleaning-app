import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listWaitlist, waitlistOpenings } from "@/lib/data/waitlist";
import { hm, longDayLabel, phoneLabel, timeLabel, ymd } from "@/lib/format";
import { Empty, Notice, Page, PageHeader } from "@/components/ui";
import { removeFromWaitlistAction } from "./actions";

export const metadata: Metadata = { title: "Waitlist" };

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export default async function WaitlistPage({ searchParams }: PageProps<"/waitlist">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const tz = staff.timezone;
  const [entries, openings] = await Promise.all([listWaitlist(staff), waitlistOpenings(staff)]);
  const openFor = (id: string) => openings.filter((o) => o.entry_id === id);
  // Waiting clients with an opening first.
  const sorted = [...entries].sort((a, b) => Number(openFor(b.id).length > 0) - Number(openFor(a.id).length > 0));
  return (
    <>
      <PageHeader title="Waitlist" back="/today" />
      <Page>
        {sp.added === "1" && <Notice kind="success">Added to the waitlist. You&apos;ll see it here and on Today when a spot opens.</Notice>}
        <p className="px-1 text-sm text-muted">
          Clients who want a day that&apos;s full. Add one from their page (Clients → the client → + Waitlist).
        </p>
        {sorted.length === 0 ? (
          <Empty title="Nobody is waiting">When a client wants a full day, add them from their page.</Empty>
        ) : (
          <ul className="space-y-2">
            {sorted.map((e) => {
              const spots = openFor(e.id);
              return (
                <li key={e.id} className={`card space-y-2 p-4 ${spots.length ? "border-gold" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/clients/${e.client_id}`} className="min-w-0">
                      <span className="block font-bold">{e.client}</span>
                      <span className="block truncate text-sm text-muted">{[e.homes, phoneLabel(e.phone)].filter(Boolean).join(" · ")}</span>
                    </Link>
                    <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">
                      {e.from_date === e.to_date ? fmt(e.from_date) : `${fmt(e.from_date)} – ${fmt(e.to_date)}`}
                    </span>
                  </div>
                  {e.note && <p className="text-sm">“{e.note}”</p>}
                  {spots.map((o) => {
                    const time = hm(o.start_at, tz);
                    const when = `${longDayLabel(o.start_at, tz)} at ${timeLabel(o.start_at, tz)}`;
                    const text = `Hi ${e.client.split(" ")[0]}! A spot just opened on ${when} with ${staff.businessName}. Would you like it? Just reply YES.`;
                    return (
                      <div key={o.start_at.toISOString()} className="space-y-2 rounded-xl bg-gold-soft p-3">
                        <p className="text-sm font-bold">🔔 A spot opened: {when} – {timeLabel(o.end_at, tz)}</p>
                        <p className="text-xs text-muted">{o.cancelled_client} cancelled.</p>
                        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
                          <a href={e.email ? `mailto:${e.email}?subject=${encodeURIComponent(`A spot opened on ${when}`)}&body=${encodeURIComponent(text)}` : `sms:${e.phone}&body=${encodeURIComponent(text)}`}
                            className="rounded-full border-2 border-brand py-2 text-center text-brand">{e.email ? "Email them" : "Text them"}</a>
                          <Link href={`/appointments/new?client=${e.client_id}&date=${ymd(o.start_at, tz)}&time=${time}`}
                            className="rounded-full bg-brand py-2 text-center text-white">Book them</Link>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm">
                    <Link href={`/appointments/new?client=${e.client_id}&date=${e.from_date}`} className="font-semibold text-brand">Book another time</Link>
                    <form action={removeFromWaitlistAction.bind(null, e.id)}>
                      <button type="submit" className="font-semibold text-muted">Remove</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-center text-xs text-muted">Booking a waiting client takes them off the list for that day.</p>
      </Page>
    </>
  );
}
