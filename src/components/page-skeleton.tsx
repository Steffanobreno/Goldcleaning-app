// Shown the moment a tab or link is tapped, while the server prepares the page,
// so the app answers right away instead of looking frozen.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 z-10 h-[60px] bg-navy" />
      <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-4">
        <div className="h-24 rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]" />
        <div className="h-4 w-32 rounded bg-line" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]" />
        ))}
      </div>
    </div>
  );
}
