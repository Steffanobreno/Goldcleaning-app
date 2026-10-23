import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { report, type Group } from "@/lib/data/reports";
import { addDaysYmd, isYmd, money, todayYmd, weekdayOf } from "@/lib/format";
import { methodLabel } from "@/lib/payment-methods";
import { Button, Input, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last30", label: "Last 30 days" },
  { key: "year", label: "This year" },
] as const;

/** First and last day (yyyy-MM-dd) of a preset period around `today`. */
function presetRange(key: string, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  const lastOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  switch (key) {
    case "week": {
      const monday = addDaysYmd(today, -((weekdayOf(today) + 6) % 7));
      return [monday, addDaysYmd(monday, 6)];
    }
    case "month":
      return [`${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-${String(lastOfMonth).padStart(2, "0")}`];
    case "last30":
      return [addDaysYmd(today, -29), today];
    case "year":
      return [`${y}-01-01`, `${y}-12-31`];
    default:
      return [today, today];
  }
}

const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => utc(d).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
const bucketLabel = (d: string, g: Group) =>
  g === "day" ? fmt(d, { weekday: "short", month: "short", day: "numeric" })
    : g === "week" ? `Week of ${fmt(d, { month: "short", day: "numeric" })}`
      : fmt(d, { month: "long", year: "numeric" });
const days = (from: string, to: string) => Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000) + 1;

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const today = todayYmd(staff.timezone);
  const custom = isYmd(sp.from) && isYmd(sp.to) && sp.from <= sp.to;
  const period = custom ? "custom" : PERIODS.some((p) => p.key === sp.period) ? String(sp.period) : "month";
  const [from, to] = custom ? [sp.from as string, sp.to as string] : presetRange(period, today);
  const length = days(from, to);
  const group: Group = sp.group === "day" || sp.group === "week" || sp.group === "month"
    ? sp.group : length <= 31 ? "day" : length <= 120 ? "week" : "month";
  const r = await report(staff, from, to, group);
  const rangeQuery = custom ? `from=${from}&to=${to}` : `period=${period}`;
  const maxBucket = Math.max(1, ...r.buckets.map((b) => Math.max(b.expected, b.collected)));
  const maxMethod = Math.max(1, ...r.methods.map((m) => m.amount + m.tips));
  const avg = r.appts ? Math.round(r.expected / r.appts) : 0;

  return (
    <>
      <PageHeader title="Reports" />
      <Page>
        <nav aria-label="Period" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/reports?period=${p.key}`} aria-current={period === p.key ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${period === p.key ? "border-navy bg-navy text-white" : "border-line bg-surface"}`}>
              {p.label}
            </Link>
          ))}
        </nav>
        <form className="card flex flex-wrap items-end gap-2 px-4 py-3">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted">From</span>
            <Input type="date" name="from" defaultValue={from} required />
          </label>
          <label className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted">To</span>
            <Input type="date" name="to" defaultValue={to} required />
          </label>
          <Button type="submit" kind="secondary">Show</Button>
        </form>
        <p className="px-1 text-sm text-muted">
          {from === to ? fmt(from, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : `${fmt(from, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(to, { month: "short", day: "numeric", year: "numeric" })}`}
          {` · ${length} day${length > 1 ? "s" : ""}`}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Collected" value={money(r.collected + r.tips)} sub={r.tips ? `incl. ${money(r.tips)} tips` : "payments received"} strong />
          <Tile label="Expected" value={money(r.expected)} sub="services booked" />
          <Tile label="Dogs groomed" value={String(r.dogs_done)} sub={`${r.pets} booked`} />
          <Tile label="Appointments" value={String(r.appts)} sub={`${r.finished} finished`} />
          <Tile label="Clients" value={String(r.clients)} sub={`${r.newClients} new`} />
          <Tile label="Average visit" value={money(avg)} sub="expected per visit" />
        </div>

        <section className="space-y-2">
          <h2 className="section-label">Money</h2>
          <dl className="card divide-y divide-line">
            <Row label="Expected service price" value={money(r.expected)} hint="Services on visits in this period (not cancelled)" />
            <Row label="Collected (without tips)" value={money(r.collected)} hint={`${r.paymentsCount} payment${r.paymentsCount === 1 ? "" : "s"} received in this period`} />
            <Row label="Tips" value={money(r.tips)} />
            <Row label="Unpaid" value={money(r.unpaid)} hint="Finished visits not checked out yet" warn={r.unpaid > 0} />
          </dl>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Appointments</h2>
          <dl className="card divide-y divide-line">
            <Row label="Booked" value={String(r.appts)} />
            <Row label="Finished" value={String(r.finished)} />
            <Row label="Cancelled" value={String(r.cancelled)} />
            <Row label="No-show" value={String(r.no_show)} warn={r.no_show > 0} />
            <Row label="New clients" value={String(r.newClients)} hint="Added in the app or online in this period" />
          </dl>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="section-label">By {group}</h2>
            <nav aria-label="Group by" className="flex gap-1 text-sm">
              {(["day", "week", "month"] as const).map((g) => (
                <Link key={g} href={`/reports?${rangeQuery}&group=${g}`} aria-current={g === group ? "true" : undefined}
                  className={`rounded-full px-3 py-1 font-semibold capitalize ${g === group ? "bg-brand-soft text-brand-strong" : "text-muted"}`}>
                  {g}
                </Link>
              ))}
            </nav>
          </div>
          {r.buckets.length === 0 ? (
            <p className="card px-4 py-6 text-center text-sm text-muted">No visits or payments in this period.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-semibold">{group}</th>
                    <th className="px-2 py-2 text-right font-semibold">Visits</th>
                    <th className="px-2 py-2 text-right font-semibold">Dogs</th>
                    <th className="px-2 py-2 text-right font-semibold">Expected</th>
                    <th className="px-4 py-2 text-right font-semibold">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.buckets.map((b) => (
                    <tr key={b.bucket} title={`${bucketLabel(b.bucket, group)}: ${b.appts} visits, ${b.dogs} dogs, ${money(b.expected)} expected, ${money(b.collected)} collected`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{bucketLabel(b.bucket, group)}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-bg" aria-hidden>
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(Math.max(b.expected, b.collected) / maxBucket) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{b.appts}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{b.dogs}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{money(b.expected)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(b.collected)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-bold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.buckets.reduce((s, b) => s + b.appts, 0)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.buckets.reduce((s, b) => s + b.dogs, 0)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{money(r.buckets.reduce((s, b) => s + b.expected, 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(r.buckets.reduce((s, b) => s + b.collected, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="section-label">By payment method</h2>
          {r.methods.length === 0 ? (
            <p className="card px-4 py-6 text-center text-sm text-muted">No payments in this period.</p>
          ) : (
            <ul className="card divide-y divide-line">
              {r.methods.map((m) => (
                <li key={m.method} className="px-4 py-3" title={`${methodLabel(m.method)}: ${money(m.amount)} + ${money(m.tips)} tips`}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{methodLabel(m.method)}</span>
                    <span className="font-semibold tabular-nums">{money(m.amount + m.tips)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-bg" aria-hidden>
                    <div className="h-2 rounded-full bg-brand" style={{ width: `${((m.amount + m.tips) / maxMethod) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {r.services.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">By service</h2>
            <ul className="card divide-y divide-line text-sm">
              {r.services.map((s) => (
                <li key={s.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-muted tabular-nums">×{s.count}</span>
                  <span className="w-20 text-right font-semibold tabular-nums">{money(s.revenue)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.topClients.length > 0 && (
          <section className="space-y-2">
            <h2 className="section-label">Top clients by spending</h2>
            <ul className="card divide-y divide-line text-sm">
              {r.topClients.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg">
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="text-muted">{c.visits} visit{c.visits > 1 ? "s" : ""}</span>
                    <span className="w-20 text-right font-semibold tabular-nums">{money(c.spent)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-center text-xs text-muted">
          Collected counts payments recorded at checkout. Visits imported from the old app have no payments here.
        </p>
      </Page>
    </>
  );
}

function Tile({ label, value, sub, strong = false }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`card px-4 py-3 ${strong ? "border-0 bg-navy text-white" : ""}`}>
      <div className={`text-xs font-semibold ${strong ? "text-white/70" : "text-muted"}`}>{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className={`text-xs ${strong ? "text-white/70" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}

function Row({ label, value, hint, warn = false }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <dt className="font-medium">{label}</dt>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <dd className={`font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</dd>
    </div>
  );
}
