"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import clsx from "clsx";
import { SPRING_SNAP } from "@/lib/motion";

/**
 * Copy-to-clipboard for identifiers (lead ids, review ids). The confirmation
 * is a local icon swap rather than a toast — a toast for something this
 * small is noise, and the feedback belongs where the click happened.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be blocked (insecure origin, denied permission).
      // Silently skipping is right: the id is already selectable on screen,
      // and an error toast for a convenience affordance is worse than none.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : label}
      className={clsx(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-text-faint",
        "transition-colors duration-[130ms] hover:bg-surface-2 hover:text-text-dim",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SPRING_SNAP}
            className="text-qualify"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SPRING_SNAP}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** A monospace identifier with a copy affordance beside it. */
export function IdChip({
  value,
  className,
  truncate = false,
}: {
  value: string;
  className?: string;
  truncate?: boolean;
}) {
  return (
    <span className={clsx("inline-flex min-w-0 items-center gap-1", className)}>
      <code
        className={clsx("t-data text-text-faint", truncate && "truncate")}
        title={truncate ? value : undefined}
      >
        {value}
      </code>
      <CopyButton value={value} label={`Copy ${value}`} />
    </span>
  );
}
