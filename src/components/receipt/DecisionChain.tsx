"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, CircleUser, Cpu, Flag } from "lucide-react";
import clsx from "clsx";
import { Eyebrow } from "@/components/ui/Panel";
import { DURATION, EASE_OUT } from "@/lib/motion";

export type StageRole = "machine" | "human" | "final" | "reject" | "shadow" | "pending";

/**
 * The machine -> human -> final sequence.
 *
 * The load-bearing rule: a human action never *replaces* the machine
 * recommendation on screen, it is drawn after it. A reviewer who approved a
 * lead ARIE wanted to reject leaves a receipt that says both things, in
 * order, permanently. Collapsing the two into a single "outcome" would
 * destroy the one thing this receipt exists to prove.
 *
 * Each stage is a separate bordered block with its own role colour and icon,
 * joined by an explicit labelled connector — hierarchy carries the meaning,
 * so it survives being read in greyscale or by a screen reader.
 */

const ROLE_STYLE: Record<
  StageRole,
  { rail: string; text: string; icon: typeof Cpu; ring: string }
> = {
  machine: { rail: "bg-machine", text: "text-machine", icon: Cpu, ring: "border-machine-edge" },
  human: { rail: "bg-human", text: "text-human", icon: CircleUser, ring: "border-human-edge" },
  final: { rail: "bg-qualify", text: "text-qualify", icon: Flag, ring: "border-qualify-edge" },
  reject: { rail: "bg-reject", text: "text-reject", icon: Flag, ring: "border-reject-edge" },
  shadow: {
    rail: "bg-shadow-role",
    text: "text-shadow-role",
    icon: Flag,
    ring: "border-shadow-edge",
  },
  pending: { rail: "bg-pending", text: "text-pending", icon: Flag, ring: "border-pending-edge" },
};

export function Stage({
  role,
  label,
  headline,
  trailing,
  children,
  index = 0,
  dashed = false,
}: {
  role: StageRole;
  label: string;
  headline: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  index?: number;
  dashed?: boolean;
}) {
  const reduced = useReducedMotion();
  const style = ROLE_STYLE[role];
  const Icon = style.icon;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0 } : { duration: DURATION.slow, delay: index * 0.09, ease: EASE_OUT }
      }
      className={clsx(
        "surface relative overflow-hidden p-5",
        dashed && "border-dashed bg-transparent shadow-none",
      )}
    >
      <span aria-hidden className={clsx("absolute inset-y-0 left-0 w-[2px]", style.rail)} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            <Icon aria-hidden className={clsx("h-3.5 w-3.5", style.text)} strokeWidth={2.25} />
            <Eyebrow>{label}</Eyebrow>
          </span>
          <p className={clsx("t-h1 mt-2 text-[1.625rem]", style.text)}>{headline}</p>
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      {children}
    </motion.div>
  );
}

/** The link between two stages, carrying *why* the sequence continued. */
export function Connector({ label, index = 0 }: { label?: string; index?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduced ? { duration: 0 } : { duration: DURATION.base, delay: index * 0.09 + 0.05 }
      }
      className="flex items-center gap-2 py-2.5 pl-5"
      aria-hidden
    >
      <ArrowDown className="h-3.5 w-3.5 text-text-faint" strokeWidth={2} />
      {label && <span className="t-label text-text-faint">{label}</span>}
    </motion.div>
  );
}

export function Chain({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex flex-col", className)}>{children}</div>;
}
