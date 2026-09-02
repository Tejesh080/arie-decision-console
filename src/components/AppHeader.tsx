"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import clsx from "clsx";
import { getDataMode } from "@/lib/api/mode";
import { Wordmark } from "./brand/Mark";
import { ConnectionStatus } from "./ConnectionStatus";
import { DemoModeChip } from "./DemoModeChip";
import { SignOutButton } from "./SignOutButton";

/**
 * Was deliberately minimal before Productization M3 — the backend exposed
 * no endpoint to list leads/reviews/receipts globally, so a "Leads" or
 * "Review queue" link could only ever 404 or lie. Batches, ICP configuration,
 * and usage are all genuinely listable now, so those three earn a spot; a
 * global lead list still isn't, so it still isn't here.
 *
 * Productization M4 adds Settings (organization/members/invitations),
 * Providers (BYOK), and Onboarding — all backed by real, listable endpoints
 * (`/organization`, `/organization/members`, `/organization/providers`,
 * `/organization/onboarding`), same bar as everything above.
 */
const NAV = [
  { href: "/", label: "Overview" },
  // Product Pivot — the primary surface: "tell me what you sell and I will
  // find the opportunities worth your attention." Placed first, ahead of
  // the CSV-first workflow it demotes but doesn't remove — "New lead" and
  // "Batches" stay reachable for anyone who still wants to bring their own
  // list.
  { href: "/discover", label: "Find customers" },
  { href: "/leads/new", label: "New lead" },
  { href: "/batches", label: "Batches" },
  // M7 Slice 6 — a plain-English question over the leads/recommendations the
  // other entries already surface individually. Placed right after the data
  // itself (batches), ahead of configuration (targeting/ICP/providers).
  { href: "/ask", label: "Ask ARIE" },
  // Targeting sits ahead of ICP, and is the entry a new customer should find
  // first: it asks two questions in plain English and generates the profile
  // that /icp otherwise expects them to construct by hand. Both remain — a
  // full navigation rework belongs to the later UX slice, not here.
  { href: "/targeting", label: "Targeting" },
  { href: "/icp", label: "ICP" },
  { href: "/providers", label: "Providers" },
  { href: "/usage", label: "Usage" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/settings", label: "Settings" },
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

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <DemoModeChip />
          <ConnectionStatus />
          {getDataMode() === "api" && <SignOutButton />}
        </div>
      </div>
    </header>
  );
}
