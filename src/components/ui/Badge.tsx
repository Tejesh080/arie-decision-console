import type { ReactNode } from "react";
import clsx from "clsx";

export type BadgeTone = "machine" | "human" | "qualify" | "reject" | "pending" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  machine: "bg-machine-dim text-machine border-machine/40",
  human: "bg-human-dim text-human border-human/40",
  qualify: "bg-qualify-dim text-qualify border-qualify/40",
  reject: "bg-reject-dim text-reject border-reject/40",
  pending: "bg-panel-2 text-pending border-border-strong",
  neutral: "bg-panel-2 text-text-dim border-border-strong",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}
