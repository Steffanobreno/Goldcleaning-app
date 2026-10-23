import Link from "next/link";

export function DayNav({
  base,
  prev,
  next,
  today,
  label,
  isToday,
}: {
  base: string;
  prev: string;
  next: string;
  today: string;
  label: string;
  isToday: boolean;
}) {
  const link = "rounded-lg px-3 py-2 text-brand hover:bg-brand-soft";
  return (
    <nav aria-label="Change date" className="flex items-center gap-1">
      <Link href={`${base}date=${prev}`} className={link} aria-label="Previous">
        ‹
      </Link>
      <span className="min-w-0 flex-1 truncate text-center font-semibold">{label}</span>
      <Link href={`${base}date=${next}`} className={link} aria-label="Next">
        ›
      </Link>
      {!isToday && (
        <Link href={`${base}date=${today}`} className={`${link} text-sm font-semibold`}>
          Today
        </Link>
      )}
    </nav>
  );
}
