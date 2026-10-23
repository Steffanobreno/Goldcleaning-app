import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { MenuButton } from "./side-menu";

// Small set of shared primitives. Pages compose these instead of styling from scratch.

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const buttonKinds = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong",
  secondary: "bg-surface text-ink border border-line hover:bg-bg",
  ghost: "text-brand hover:bg-brand-soft",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft",
};
type Kind = keyof typeof buttonKinds;

export function Button({ kind = "primary", className = "", ...props }: ComponentProps<"button"> & { kind?: Kind }) {
  return <button className={`${buttonBase} ${buttonKinds[kind]} ${className}`} {...props} />;
}

export function ButtonLink({
  kind = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { kind?: Kind }) {
  return <Link className={`${buttonBase} ${buttonKinds[kind]} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] ${className}`} {...props} />;
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-navy text-white shadow-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        {back ? (
          <Link href={back} className="-ml-2 rounded-lg p-2 text-white hover:bg-white/10" aria-label="Back">
            <span aria-hidden>←</span>
          </Link>
        ) : (
          <MenuButton />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 pb-28">{children}</main>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-brand focus:outline-none";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  const styles = {
    info: "bg-brand-soft text-brand-strong",
    error: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
  };
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-sm ${styles[kind]}`}>
      {children}
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  requested: { label: "Requested", className: "bg-warn-soft text-warn" },
  waitlist: { label: "Waitlist", className: "bg-bg text-muted" },
  unconfirmed: { label: "Not confirmed", className: "bg-warn-soft text-warn" },
  confirmed: { label: "Confirmed", className: "bg-brand-soft text-brand-strong" },
  en_route: { label: "On the way", className: "bg-brand text-on-brand" },
  in_progress: { label: "Checked in", className: "bg-success text-white" },
  completed_unpaid: { label: "Unpaid", className: "bg-danger-soft text-danger" },
  completed: { label: "Done", className: "bg-success-soft text-success" },
  paid: { label: "Paid", className: "bg-success-soft text-success" },
  cancelled: { label: "Cancelled", className: "bg-bg text-muted line-through" },
  no_show: { label: "No-show", className: "bg-danger-soft text-danger" },
  declined: { label: "Declined", className: "bg-bg text-muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-bg text-muted" };
  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}

export const statusLabel = (status: string) => STATUS[status]?.label ?? status;
