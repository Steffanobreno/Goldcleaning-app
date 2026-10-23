import Link from "next/link";

/** "All · Steffano · Maria" chips, shown only when the business has more than one groomer. */
export function GroomerFilter({ groomers, current, href, allowAll = true }: {
  groomers: { id: string; name: string; color: string }[];
  current: string | null; // null = all
  href: (groomer: string | null) => string;
  allowAll?: boolean;
}) {
  if (groomers.length < 2) return null;
  const chip = (on: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-line bg-surface"}`;
  return (
    <nav aria-label="Groomer" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {allowAll && <Link href={href(null)} aria-current={current === null ? "true" : undefined} className={chip(current === null)}>All</Link>}
      {groomers.map((g) => (
        <Link key={g.id} href={href(g.id)} aria-current={current === g.id ? "true" : undefined} className={chip(current === g.id)}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
          {g.name}
        </Link>
      ))}
    </nav>
  );
}
