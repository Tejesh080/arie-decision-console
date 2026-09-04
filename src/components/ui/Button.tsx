"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import clsx from "clsx";
import { SPRING_SNAP } from "@/lib/motion";
import { pointerGlowLeave, pointerGlowMove } from "@/lib/pointerGlow";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "human" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * The app's whole button hierarchy: one signal-filled button, one raised
 * neutral, one text-only, plus the two role-coloured variants the review
 * checkpoint needs (`human` to submit, `danger` to reject).
 *
 * These are objects, not rectangles. Every variant has real travel on press
 * (a transform, not a colour change), an edge-lit top rim, and — on the
 * filled variants — a sheen that sweeps across on hover. The press is CSS
 * rather than Motion so a list of thirty buttons doesn't mount thirty
 * animation loops for a 90ms effect; only the loading/success swap, which
 * happens to at most one button at a time, uses Motion.
 */
const BASE =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden " +
  "font-medium whitespace-nowrap will-change-transform " +
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] " +
  "duration-[140ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
  "active:scale-[0.975] active:duration-[80ms] " +
  "disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100";

/** The hover sheen: a narrow highlight that sweeps across a filled button.
 * Pure transform on a gradient — no filter, no repaint. */
const SHEEN =
  "before:pointer-events-none before:absolute before:inset-0 before:-translate-x-full " +
  "before:bg-[linear-gradient(105deg,transparent_35%,rgba(255,255,255,0.35)_50%,transparent_65%)] " +
  "before:transition-transform before:duration-[620ms] before:ease-[cubic-bezier(0.22,1,0.36,1)] " +
  "hover:before:translate-x-full motion-reduce:before:hidden";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(180deg,#69f0d3,#3fd2b2)] text-[#04120f] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.45),0_0_0_0_rgba(79,227,193,0)] " +
    "hover:shadow-[0_6px_22px_-6px_rgba(79,227,193,0.55),inset_0_1px_0_rgba(255,255,255,0.5)] " +
    "hover:-translate-y-px " +
    SHEEN,
  secondary:
    "border border-border-strong bg-surface-2 text-text " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)] " +
    "hover:border-border-loud hover:bg-surface-3 hover:-translate-y-px " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_18px_-8px_rgba(0,0,0,0.6)]",
  ghost: "text-text-dim hover:bg-surface-2 hover:text-text",
  human:
    "bg-[linear-gradient(180deg,#ffca74,#eda942)] text-[#1a1103] " +
    "shadow-[0_1px_2px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] " +
    "hover:shadow-[0_6px_22px_-6px_rgba(245,182,92,0.5),inset_0_1px_0_rgba(255,255,255,0.45)] " +
    "hover:-translate-y-px " +
    SHEEN,
  danger:
    "border border-reject-edge bg-reject-dim text-reject " +
    "hover:border-reject hover:bg-[#48212a] hover:-translate-y-px",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 rounded-[10px] px-3 text-[0.8125rem]",
  md: "h-10 rounded-xl px-4 text-sm",
  // Pill-shaped: the size marketing CTAs use, so it gets the fuller shape.
  // Everything smaller stays a rounded rectangle so dense UI doesn't turn
  // into a row of capsules.
  lg: "h-[3.25rem] rounded-full px-7 text-[0.9688rem]",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
  glow = false,
) {
  return clsx(BASE, VARIANTS[variant], SIZES[size], glow && "btn-glow", className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the label for a spinner and blocks interaction. */
  loading?: boolean;
  /** Momentarily swaps the label for a check — set it, then clear it. */
  success?: boolean;
  /** Announced instead of the label while `loading`. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    className,
    children,
    loading = false,
    success = false,
    loadingLabel = "Working",
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      onPointerMove={pointerGlowMove}
      onPointerLeave={pointerGlowLeave}
      className={buttonClass(variant, size, className, true)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <ButtonBody loading={loading} success={success} loadingLabel={loadingLabel}>
        {children}
      </ButtonBody>
    </button>
  );
});

/**
 * The label/spinner/check swap. The three states cross-fade in place and
 * the button keeps its width, so a row of controls never reflows when one
 * of them starts working.
 */
function ButtonBody({
  loading,
  success,
  loadingLabel,
  children,
}: {
  loading: boolean;
  success: boolean;
  loadingLabel: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const state = loading ? "loading" : success ? "success" : "idle";

  const fade = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: SPRING_SNAP,
      };

  return (
    <>
      {/* The label always stays in the accessibility tree, in every state:
          it is the button's accessible name, and a spinner that replaces it
          leaves a nameless button behind. While working it only goes
          visually transparent — it still reserves the width, so the swap
          can't resize the button — and `aria-busy` on the button carries
          the state. */}
      <span
        className={clsx(
          "inline-flex items-center gap-2 transition-opacity duration-150",
          state !== "idle" && "opacity-0",
        )}
      >
        {children}
      </span>

      <AnimatePresence initial={false} mode="wait">
        {state === "loading" && (
          <motion.span
            key="loading"
            {...fade}
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
          >
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          </motion.span>
        )}
        {state === "success" && (
          <motion.span
            key="success"
            {...fade}
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
          >
            <Check className="h-4 w-4" strokeWidth={2.75} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Announced politely rather than by renaming the control. */}
      <span className="sr-only" role="status">
        {state === "loading" ? loadingLabel : state === "success" ? "Done" : ""}
      </span>
    </>
  );
}

/** Same visual language for navigation. Kept as a separate component rather
 * than an `as` prop so `next/link` prefetching and typed routes still work. */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onPointerMove={pointerGlowMove}
      onPointerLeave={pointerGlowLeave}
      className={buttonClass(variant, size, className, true)}
    >
      {children}
    </Link>
  );
}
