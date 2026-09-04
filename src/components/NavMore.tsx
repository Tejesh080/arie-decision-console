"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { SPRING_SNAP } from "@/lib/motion";

/**
 * The overflow disclosure for configuration-ish nav items.
 *
 * A disclosure, not a `role="menu"` — these are page links a reader tabs
 * through and follows, not application commands needing roving-tabindex
 * arrow-key semantics.
 */
export function NavMore({ items }: { items: ReadonlyArray<{ href: string; label: string }> }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const active = items.some((item) => pathname.startsWith(item.href));

  // A route change closes the panel. Reset during render (React's
  // documented pattern — state, not a ref, since a ref can't be read during
  // render) rather than in an effect, so there's no extra render pass.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative flex items-center gap-1 rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors duration-[140ms]",
          active || open ? "text-text" : "text-text-dim hover:text-text",
        )}
      >
        {(active || open) && (
          <span
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
          />
        )}
        More
        <ChevronDown
          aria-hidden
          strokeWidth={2.25}
          className={clsx(
            "h-3.5 w-3.5 text-text-faint transition-transform duration-[220ms]",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            initial={reduced ? false : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={SPRING_SNAP}
            className={clsx(
              "absolute top-[calc(100%+10px)] right-0 z-50 w-56 origin-top-right overflow-hidden rounded-2xl",
              "border border-white/[0.08] bg-[rgba(18,21,29,0.95)] p-1.5 backdrop-blur-2xl",
              "shadow-[0_30px_70px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]",
            )}
          >
            {items.map((item) => {
              const itemActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={itemActive ? "page" : undefined}
                  className={clsx(
                    "flex items-center justify-between rounded-xl px-3 py-2.5 text-[0.8125rem] transition-colors duration-[120ms]",
                    itemActive
                      ? "bg-white/[0.06] text-text"
                      : "text-text-dim hover:bg-white/[0.04] hover:text-text",
                  )}
                >
                  {item.label}
                  {itemActive && (
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-qualify" />
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
