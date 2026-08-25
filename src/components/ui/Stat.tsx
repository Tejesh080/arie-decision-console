import type { ReactNode } from "react";
import clsx from "clsx";
import { Eyebrow } from "./Panel";

/**
 * Label-over-value metric block. `hint` sits to the right of the label for
 * the comparison figure a number is read against (a threshold, a cap).
 */
export function Stat({
  label,
  hint,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  hint?: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "machine" | "human" | "qualify" | "reject" | "shadow" | "default";
  className?: string;
}) {
  const valueTone =
    tone === "machine"
      ? "text-machine"
      : tone === "human"
        ? "text-human"
        : tone === "qualify"
          ? "text-qualify"
          : tone === "reject"
            ? "text-reject"
            : tone === "shadow"
              ? "text-shadow-role"
              : "text-text";

  return (
    <div className={clsx("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        {hint && (
          <span className="t-data hidden text-[0.6875rem] text-text-faint sm:inline">{hint}</span>
        )}
      </div>
      <p className={clsx("t-metric mt-2 text-[1.75rem]", valueTone)}>{value}</p>
      {sub && <p className="mt-1.5 text-xs leading-snug text-text-faint">{sub}</p>}
    </div>
  );
}

/** A row of stats separated by hairlines. Collapses to a 2-up grid on
 * narrow screens rather than shrinking the figures below legibility. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4",
        "[&>*+*]:sm:border-l [&>*+*]:sm:border-border [&>*+*]:sm:pl-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
