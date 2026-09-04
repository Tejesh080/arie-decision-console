import type { ReactNode } from "react";
import clsx from "clsx";

export type BadgeTone =
  | "machine"
  | "human"
  | "qualify"
  | "reject"
  | "pending"
  | "neutral"
  | "shadow";

const TONE_CLASSES: Record<BadgeTone, string> = {
  machine: "bg-machine-dim text-machine ring-machine-edge/60",
  human: "bg-human-dim text-human ring-human-edge/60",
  qualify: "bg-qualify-dim text-qualify ring-qualify-edge/60",
  reject: "bg-reject-dim text-reject ring-reject-edge/60",
  pending: "bg-pending-dim text-pending ring-pending-edge/60",
  neutral: "bg-white/[0.045] text-text-dim ring-white/[0.08]",
  shadow: "bg-shadow-dim text-shadow-role ring-shadow-edge/60",
};

/**
 * A status chip. Sentence case, not all-caps: a screen carrying six
 * shouting micro-labels reads as noise, and the tone already does the
 * signalling. `variant="outline"` drops the tinted fill and dashes the edge
 * — reserved for shadow mode, where the whole point is that the state was
 * computed but is not authoritative.
 *
 * The edge is a `ring` rather than a `border` so a badge never changes size
 * between variants and never nudges the text baseline beside it.
 */
export function Badge({
  tone = "neutral",
  variant = "solid",
  size = "md",
  className,
  children,
}: {
  tone?: BadgeTone;
  variant?: "solid" | "outline";
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "sm"
          ? "px-2 py-0.5 text-[0.6875rem] tracking-[0.01em]"
          : "px-2.5 py-1 text-[0.75rem] tracking-[0.005em]",
        TONE_CLASSES[tone],
        variant === "outline" && "bg-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
