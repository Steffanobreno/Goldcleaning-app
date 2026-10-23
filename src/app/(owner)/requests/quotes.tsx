import Link from "next/link";
import { dayLabel, phoneLabel, timeLabel } from "@/lib/format";
import { QUOTE_KIND_LABEL, type QuoteRow } from "@/lib/data/quotes";
import { Button, Card, Empty } from "@/components/ui";
import { convertQuoteAction, setQuoteStatusAction } from "./quote-actions";

/** The Quotes tab: Airbnb and office requests, newest first, with their photos. */
export function QuoteList({ quotes, tz, closed }: { quotes: QuoteRow[]; tz: string; closed: boolean }) {
  if (quotes.length === 0) {
    return <Empty title={closed ? "Nothing archived yet" : "No quote requests"}>Airbnb and office requests from your booking page show up here.</Empty>;
  }
  return (
    <>
      {quotes.map((q) => {
        const size = q.kind === "office"
          ? q.square_feet ? `${q.square_feet.toLocaleString("en-US")} sq ft` : null
          : [q.bedrooms != null ? `${q.bedrooms} bd` : null, q.full_baths != null ? `${q.full_baths} ba` : null].filter(Boolean).join(" / ") || null;
        return (
          <Card key={q.id} role="article" aria-label={`${q.first_name} ${q.last_name}`} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{q.first_name} {q.last_name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${q.status === "new" ? "bg-warn-soft text-warn" : "bg-bg text-muted"}`}>
                {q.status === "new" ? "New" : q.status === "replied" ? "Replied" : q.status === "converted" ? "Client" : "Archived"}
              </span>
            </div>
            <p className="text-sm font-medium">{QUOTE_KIND_LABEL[q.kind]}{size ? ` · ${size}` : ""}{q.frequency ? ` · ${q.frequency}` : ""}</p>
            <p className="text-sm text-muted">{[q.city, q.zip].filter(Boolean).join(" ")} · {dayLabel(q.created_at, tz)} {timeLabel(q.created_at, tz)}</p>
            <p className="whitespace-pre-line rounded-xl bg-bg p-2 text-sm">{q.message}</p>
            {q.photo_ids.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {q.photo_ids.map((p, i) => (
                  <li key={p}>
                    <a href={`/api/quotes/${q.id}/photo/${p}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private photo served by the app */}
                      <img src={`/api/quotes/${q.id}/photo/${p}`} alt={`Photo ${i + 1} from ${q.first_name}`} className="h-20 w-20 rounded-xl object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
              <a href={`mailto:${q.email}?subject=${encodeURIComponent("Your cleaning quote")}`} className="rounded-xl border border-line py-2 text-center text-brand">Email</a>
              <a href={`tel:${q.phone}`} className="rounded-xl border border-line py-2 text-center text-brand">Call</a>
              <a href={`sms:${q.phone}`} className="rounded-xl border border-line py-2 text-center text-brand">Text</a>
            </div>
            <p className="text-xs text-muted">{q.email} · {phoneLabel(q.phone)}</p>
            {q.status === "converted" && q.client_id ? (
              <Link href={`/clients/${q.client_id}`} className="block text-sm font-semibold text-brand underline">Open the client</Link>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {q.status === "archived" ? (
                  <form action={setQuoteStatusAction.bind(null, q.id, "new")} className="col-span-2">
                    <Button type="submit" kind="secondary" className="w-full">Restore</Button>
                  </form>
                ) : (
                  <>
                    {q.status === "new" ? (
                      <form action={setQuoteStatusAction.bind(null, q.id, "replied")}>
                        <Button type="submit" kind="secondary" className="w-full">Mark replied</Button>
                      </form>
                    ) : (
                      <form action={setQuoteStatusAction.bind(null, q.id, "archived")}>
                        <Button type="submit" kind="secondary" className="w-full">Archive</Button>
                      </form>
                    )}
                    <form action={convertQuoteAction.bind(null, q.id)}>
                      <Button type="submit" className="w-full">Make client and book</Button>
                    </form>
                    {q.status === "new" && (
                      <form action={setQuoteStatusAction.bind(null, q.id, "archived")} className="col-span-2">
                        <button type="submit" className="w-full py-1 text-sm font-semibold text-muted">Archive</button>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
