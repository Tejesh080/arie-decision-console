"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { SPRING_SNAP, stagger } from "@/lib/motion";
import { tapHaptic } from "@/lib/haptics";

/**
 * The `lg:hidden` counterpart to the dock's primary row: below `lg` there
 * isn't room for the row or the "More" disclosure, so every destination
 * folds into one sheet behind a single trigger.
 *
 * Rows are 48px tall with the label at full size — a phone shouldn't get
 * the desktop's 13px nav text shrunk further.
 */
export function MobileNav({ items }: { items: ReadonlyArray<{ href: string; label: string }> }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const id = useId();

  // Closes on navigation, same render-time reset as `NavMore`.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    // A sheet this size warrants trapping background scroll.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="ml-auto lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => {
          tapHaptic();
          setOpen((v) => !v);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-text-dim transition-colors duration-[140ms] hover:bg-white/[0.06] hover:text-text active:scale-95"
      >
        {open ? (
          <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
        ) : (
          <Menu aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 top-0 z-30 cursor-default bg-[rgba(4,5,8,0.6)]"
            />
            <motion.nav
              id={id}
              aria-label="Primary"
              initial={reduced ? false : { opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.99 }}
              transition={SPRING_SNAP}
              className={clsx(
                "fixed inset-x-3 top-[4.75rem] z-40 max-h-[calc(100dvh-6rem)] origin-top overflow-y-auto sm:inset-x-5",
                "rounded-3xl border border-white/[0.08] bg-[rgba(16,19,26,0.96)] p-2 backdrop-blur-2xl",
                "shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.07)]",
                "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
              )}
            >
              <motion.ul variants={stagger(0.028)} initial="hidden" animate="show">
                {items.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <motion.li
                      key={item.href}
                      variants={
                        reduced
                          ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
                          : {
                              hidden: { opacity: 0, y: 6 },
                              show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
                            }
                      }
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "flex min-h-12 items-center justify-between rounded-2xl px-4 text-[0.9375rem] transition-colors duration-[140ms]",
                          active
                            ? "bg-white/[0.06] font-medium text-text"
                            : "text-text-dim hover:bg-white/[0.03] hover:text-text",
                        )}
                      >
                        {item.label}
                        {active && (
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-qualify" />
                        )}
                      </Link>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
