"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import clsx from "clsx";
import { getDataMode } from "@/lib/api/mode";
import { Magnetic } from "@/components/ui/Magnetic";
import { Wordmark } from "./brand/Mark";
import { CommandLauncher } from "./CommandPalette";
import { ConnectionStatus } from "./ConnectionStatus";
import { DemoModeChip } from "./DemoModeChip";
import { MobileNav } from "./MobileNav";
import { NavMore } from "./NavMore";
import { SignOutButton } from "./SignOutButton";

/**
 * The header is a floating dock, not a page-wide bar: it sits inset from
 * the edges on its own plane, so the page scrolls *under* an object rather
 * than beneath a lid welded to the viewport.
 *
 * Navigation is split in two tiers. `PRIMARY_NAV` are the day-to-day
 * surfaces and live in the dock; the configuration-ish rest live behind the
 * "More" disclosure at `lg:` and up, or fold into the same sheet as the
 * primary items below it. The full 11-item list overflowed its own row at
 * ordinary desktop widths (measured ~131px over at 1440px), pushing the
 * status chips and "Sign out" past the edge of the screen entirely.
 */
const PRIMARY_NAV = [
  { href: "/", label: "Overview" },
  // The primary surface: "tell me what you sell and I'll find the companies
  // worth your attention." Placed first, ahead of the CSV-first workflow it
  // demotes but doesn't remove.
  { href: "/discover", label: "Find customers" },
  { href: "/leads/new", label: "New lead" },
  { href: "/batches", label: "History" },
  { href: "/ask", label: "Ask ARIE" },
] as const;

const SECONDARY_NAV = [
  // Targeting sits ahead of ICP, and is the entry a new customer should
  // find first: it asks two questions in plain English and generates the
  // profile that /icp otherwise expects them to construct by hand.
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

  // Subscribing to the motion value rather than a scroll listener keeps
  // this off the React render path until the boolean actually flips.
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 12;
    setLifted((prev) => (prev === next ? prev : next));
  });

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      {/* A scrim behind the floating dock. Without it the page's own
          headings ghost through the pill as they scroll under it — at any
          translucency short of opaque — which reads as a rendering fault.
          The band fades out below the dock so the dock still reads as an
          object on its own plane rather than a bar welded to the viewport. */}
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 transition-opacity duration-300",
          lifted ? "opacity-100" : "opacity-0",
        )}
        style={{
          background:
            "linear-gradient(to bottom, var(--bg) 38%, rgba(10,12,17,0.86) 66%, rgba(10,12,17,0))",
        }}
      />
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-6 focus:left-8 focus:z-50 focus:rounded-full focus:bg-qualify focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#04120f]"
      >
        Skip to content
      </a>

      <div
        className={clsx(
          "liquid-edge mx-auto flex h-14 max-w-[1240px] items-center gap-2 rounded-full pr-2 pl-3 sm:gap-3 sm:pr-2.5 sm:pl-4",
          "transition-[background-color,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          // Opaque enough to actually occlude: at 0.82 the page's own
          // headings read through the dock as a smudge while scrolling,
          // which looks like a rendering fault rather than translucency.
          lifted
            ? "glass-dock border border-white/[0.07] shadow-[0_18px_44px_-24px_rgba(0,0,0,0.9)]"
            : "border border-transparent bg-transparent",
        )}
      >
        <Link
          href="/"
          aria-label="ARIE, back to overview"
          className="shrink-0 rounded-full py-1 pr-1"
        >
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="ml-auto hidden items-center gap-0.5 rounded-full lg:flex"
        >
          {PRIMARY_NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Magnetic key={item.href} strength={6}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative block rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors duration-[140ms]",
                    active ? "text-text" : "text-text-dim hover:text-text",
                  )}
                >
                  {active && (
                    <motion.span
                      aria-hidden
                      layoutId="nav-active"
                      className="spectral-edge absolute inset-0 -z-10 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      transition={{ type: "spring", stiffness: 460, damping: 38, mass: 0.8 }}
                    />
                  )}
                  {item.label}
                </Link>
              </Magnetic>
            );
          })}
          <NavMore items={SECONDARY_NAV} />
        </nav>

        <MobileNav items={[...PRIMARY_NAV, ...SECONDARY_NAV]} />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <DemoModeChip className="hidden sm:flex" />
          <ConnectionStatus />
          <CommandLauncher />
          {getDataMode() === "api" && <SignOutButton />}
        </div>
      </div>
    </header>
  );
}
