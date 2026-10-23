"use client";
import { useState } from "react";

/**
 * A read-only value with a Copy button (links the owner pastes into other apps).
 * `multiline` shows a block of code (a script to paste) instead of one line.
 */
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const box = "min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-muted";
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className={multiline ? "flex flex-col gap-2" : "flex gap-2"}>
        {multiline ? (
          <textarea readOnly value={value} aria-label={label} rows={8} onFocus={(e) => e.currentTarget.select()}
            className={`${box} font-mono text-xs`} />
        ) : (
          <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className={box} />
        )}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className={`rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-brand ${multiline ? "py-2.5" : ""}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
