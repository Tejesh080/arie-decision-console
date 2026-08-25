"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "human" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * The app's whole button hierarchy. Deliberately small: one filled accent
 * button, one outlined, one text-only, plus the two role-coloured variants
 * the review checkpoint needs (`human` to submit, `danger` to reject).
 *
 * The press feedback is CSS, not Motion — a `transform` on :active costs
 * nothing and never drops a frame, where a spring on every button in a list
 * would mount dozens of animation loops for a 90ms effect.
 */
const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-[--r-md] " +
  "font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] " +
  "duration-[130ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-machine text-[#06080d] shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.22)] " +
    "hover:brightness-110 hover:-translate-y-px active:brightness-95",
  secondary:
    "border border-border-strong bg-surface-2 text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] " +
    "hover:border-border-loud hover:bg-surface-3 hover:-translate-y-px",
  ghost: "text-text-dim hover:bg-surface-2 hover:text-text",
  human:
    "bg-human text-[#160f02] shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] " +
    "hover:brightness-110 hover:-translate-y-px active:brightness-95",
  danger:
    "border border-reject-edge bg-reject-dim text-reject " +
    "hover:border-reject hover:bg-[#4a1e23] hover:-translate-y-px",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-9.5 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return clsx(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, ...rest },
  ref,
) {
  return <button ref={ref} className={buttonClass(variant, size, className)} {...rest} />;
});

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
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
