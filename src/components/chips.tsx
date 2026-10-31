/** Plain tags (client tags), small, for lists and the client page. */
export function TagChips({ tags }: { tags: string[] | undefined }) {
  if (!tags?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold leading-4 text-brand-strong">{t}</span>
      ))}
    </span>
  );
}
