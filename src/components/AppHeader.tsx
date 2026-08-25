"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import clsx from "clsx";
import { Wordmark } from "./brand/Mark";
import { ConnectionStatus } from "./ConnectionStatus";

/**
 * Navigation stays deliberately small. The backend exposes no endpoint to
 * list leads, reviews or receipts globally, so there is no honest "Leads" or
 * "Review queue" destination to link to — inventing one would be a nav item
 * that can only ever 404 or lie.
 */
const NAV = [
  { href: "/", label: "Overview" },
  { href: "/leads/new", label: "New lead" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [lifted, setLifted] = useState(false);

  // Subscribing to the motion value rather than a scroll listener keeps this
  // off the React render path until the boolean actually flips.
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 8;
    setLifted((prev) => (prev === next ? prev : next));
  });

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        lifted
          ? "border-b border-border bg-bg/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:bg-machine focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-[#06080d]"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 sm:gap-6 sm:px-8">
        <Link
          href="/"
          aria-label="ARIE — Decision Console, back to overview"
          className="shrink-0 rounded-md"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="ml-auto flex items-center gap-0.5 sm:ml-2 sm:gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative rounded-md px-2.5 py-1.5 text-[0.8125rem] transition-colors duration-[130ms] sm:px-3",
                  active ? "text-text" : "text-text-dim hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-md border border-border-strong bg-surface-2"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center">
          <ConnectionStatus />
        </div>
      </div>
    </header>
  );
}
