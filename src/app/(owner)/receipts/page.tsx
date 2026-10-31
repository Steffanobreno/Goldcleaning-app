import { DateField } from "@/components/date-field";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listReceipts } from "@/lib/data/receipts";
import { addDaysYmd, dayLabel, isYmd, money, todayYmd, zonedToUtc } from "@/lib/format";
import { Empty, Page, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Receipts" };

// Every paid receipt in a period: open one, or download them all as one PDF.
export default async function ReceiptsPage({ searchParams }: PageProps<"/receipts">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const today = todayYmd(staff.timezone);
  const from = isYmd(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = isYmd(sp.to) && sp.to >= from ? sp.to : today;
  const list = await listReceipts(staff.businessId, zonedToUtc(from, "00:00", staff.timezone), zonedToUtc(addDaysYmd(to, 1), "00:00", staff.timezone));
  const total = list.reduce((s, r) => s + r.total_cents, 0);
  return (
    <>
      <PageHeader title="Receipts" />
      <Page>
        <form className="card grid grid-cols-[1fr_1fr_auto] items-end gap-2 p-3">
          <label className="text-xs font-semibold text-muted">From<DateField name="from" defaultValue={from} /></label>
          <label className="text-xs font-semibold text-muted">To<DateField name="to" defaultValue={to} /></label>
          <button type="submit" className="rounded-xl bg-navy px-4 py-2.5 font-semibold text-white">Show</button>
        </form>
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="font-semibold">{list.length} receipt{list.length === 1 ? "" : "s"} · {money(total)}</span>
          {list.length > 0 && (
            <a href={`/receipts/pdf?from=${from}&to=${to}`} className="rounded-full bg-brand px-4 py-2 font-bold text-white">
              Download all (PDF)
            </a>
          )}
        </div>
        {list.length === 0 ? (
          <Empty title="No receipts in these days">Finished and paid cleanings show here.</Empty>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {[...list].reverse().map((r) => (
              <li key={r.id}>
                <Link href={r.appointment_id ? `/appointments/${r.appointment_id}/checkout` : `/receipts/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                  <span className="w-14 shrink-0 text-sm font-bold text-muted">#{r.receipt_no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.client}</span>
                    <span className="block text-xs text-muted">{dayLabel(r.closed_at, staff.timezone)}{r.appointment_id ? "" : " · written by hand"}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(r.total_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
