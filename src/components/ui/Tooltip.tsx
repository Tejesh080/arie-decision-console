"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";

/**
 * A small explanatory tooltip. CSS-positioned rather than floating-ui: every
 * tooltip in this app hangs below a short trigger inside a normal-width
 * container, so the one case a positioning library exists to solve — flipping
 * near a viewport edge — is handled by clamping the width and centring.
 *
 * Opens on hover *and* focus, and is reachable by keyboard: the trigger is a
 * real button with `aria-describedby`, so the content is announced rather
 * than being pointer-only trivia.
 */
export function Tooltip({
  label,
  children,
  align = "center",
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "center" | "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const id = useId();

  return (
    <span
      className={clsx("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex cursor-help items-center rounded-full text-left"
      >
        {children}
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={reduced ? false : { opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -3 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            className={clsx(
              "absolute top-[calc(100%+8px)] z-50 w-[min(19rem,78vw)] rounded-lg border border-border-strong",
              "bg-surface-2 px-3 py-2.5 text-xs leading-relaxed font-normal normal-case tracking-normal text-text-dim",
              "shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]",
              align === "center" && "left-1/2 -translate-x-1/2",
              align === "start" && "left-0",
              align === "end" && "right-0",
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
