"use client"; // Error boundaries must be Client Components

// When a screen fails to load (usually the free database waking up, or a weak signal),
// show a friendly message with a button that tries again instead of a dead end.
export default function OwnerError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
      <img src="/apple-icon.png" alt="" width={72} height={72} className="h-18 w-18 rounded-2xl" />
      <h1 className="text-2xl font-extrabold">That took too long</h1>
      <p className="text-muted">The app was waking up or the signal dropped. Try again: it usually works on the second tap.</p>
      <button type="button" onClick={() => retry()} className="w-full rounded-full bg-brand py-3.5 text-lg font-bold text-white">
        Try again
      </button>
      {error.digest && <p className="text-xs text-muted">Code {error.digest}</p>}
    </main>
  );
}
