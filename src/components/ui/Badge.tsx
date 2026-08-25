import type { ReactNode } from "react";
import clsx from "clsx";

export type BadgeTone =
  "machine" | "human" | "qualify" | "reject" | "pending" | "neutral" | "shadow";

const TONE_CLASSES: Record<BadgeTone, string> = {
  machine: "bg-machine-dim text-machine border-machine-edge",
  human: "bg-human-dim text-human border-human-edge",
  qualify: "bg-qualify-dim text-qualify border-qualify-edge",
  reject: "bg-reject-dim text-reject border-reject-edge",
  pending: "bg-pending-dim text-pending border-pending-edge",
  neutral: "bg-surface-2 text-text-dim border-border-strong",
  shadow: "bg-shadow-dim text-shadow-role border-shadow-edge",
};

/**
 * A status chip. `variant="outline"` drops the tinted fill and dashes the
 * border — reserved for shadow mode, where the whole visual point is that
 * the state was computed but is not authoritative.
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium tracking-[0.06em] uppercase",
        size === "sm" ? "px-2 py-0.5 text-[0.625rem]" : "px-2.5 py-1 text-[0.6875rem]",
        TONE_CLASSES[tone],
        variant === "outline" && "border-dashed bg-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
