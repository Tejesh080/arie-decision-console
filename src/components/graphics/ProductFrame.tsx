"use client";

import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Circle, Mail, Search } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";

type Row = {
  company: string;
  domain: string;
  tint: string;
  status: "contact_first" | "review";
  fit: number;
  reason: string;
  buyer: string;
  buyerRole: string;
};

const ROWS: Row[] = [
  {
    company: "Northwind Logistics",
    domain: "northwindlogistics.example",
    tint: "linear-gradient(140deg, hsl(206 55% 30%), hsl(246 40% 18%))",
    status: "contact_first",
    fit: 91,
    reason: "Just posted 12 warehouse roles this month.",
    buyer: "M. Alvarez",
    buyerRole: "Director of Operations",
  },
  {
    company: "Solstice Robotics",
    domain: "solsticerobotics.example",
    tint: "linear-gradient(140deg, hsl(162 50% 28%), hsl(196 45% 18%))",
    status: "contact_first",
    fit: 87,
    reason: "Opened a second production line last quarter.",
    buyer: "J. Chen",
    buyerRole: "VP Engineering",
  },
  {
    company: "Ferro Metalworks",
    domain: "ferrometalworks.example",
    tint: "linear-gradient(140deg, hsl(28 55% 30%), hsl(6 45% 20%))",
    status: "review",
    fit: 76,
    reason: "New safety compliance mandate takes effect in 60 days.",
    buyer: "",
    buyerRole: "Head of Procurement",
  },
];

/**
 * The hero's concrete object: not an abstract diagram, but a stylised
 * screenshot of the actual surface `/discover` produces — three real result
 * rows, in the same visual language `OpportunityCard` uses (priority dot,
 * verified badge, fit score, buyer chip). Whoever lands on the homepage
 * should recognise the product immediately, not decode an illustration.
 */
export function ProductFrame() {
  const reduced = useReducedMotion();
  const arrive = (delay: number) =>
    reduced ? { duration: 0 } : { delay, duration: 0.55, ease: EASE_OUT };

  return (
    <div className="relative mx-auto w-full max-w-[880px]">
      {/* Floating badges — outside the frame, each one a plain, self-
          explanatory fact rather than an unlabelled node in a diagram. */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={arrive(0.5)}
        style={{ animation: reduced ? undefined : "arie-float 7.5s ease-in-out infinite" }}
        className="liquid-surface liquid-edge absolute -top-5 right-6 z-20 hidden items-center gap-2 rounded-full py-2 pr-4 pl-2.5 shadow-[var(--e-2)] sm:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-qualify-dim text-qualify ring-1 ring-qualify-edge/60 ring-inset">
          <BadgeCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="t-sys whitespace-nowrap text-text-dim">2 ready to contact</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={arrive(0.65)}
        style={{ animation: reduced ? undefined : "arie-float 8.5s ease-in-out infinite 0.4s" }}
        className="liquid-surface liquid-edge absolute -bottom-5 left-6 z-20 hidden items-center gap-2 rounded-full py-2 pr-4 pl-2.5 shadow-[var(--e-2)] sm:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-machine-dim text-machine ring-1 ring-machine-edge/60 ring-inset">
          <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="t-sys whitespace-nowrap text-text-dim">37 companies screened</span>
      </motion.div>

      {/* The frame itself. */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={arrive(0.2)}
        className="liquid-surface liquid-edge spectral-edge grain-veil relative overflow-hidden rounded-[1.75rem]"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-black/25 px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[0.75rem] text-text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-qualify" />
            arie.app/discover
          </div>
        </div>

        {/* Product content */}
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.9375rem] font-semibold text-text">3 opportunities found</p>
            <p className="t-sys text-text-faint">This week</p>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {ROWS.map((row) => (
              <div
                key={row.company}
                className="flex flex-col gap-3 rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.05] ring-inset sm:flex-row sm:items-center sm:gap-4"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-semibold text-white/90 ring-1 ring-white/[0.08] ring-inset"
                  style={{ background: row.tint }}
                >
                  {row.company
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate text-[0.875rem] font-medium text-text">{row.company}</p>
                    <span
                      className={
                        "inline-flex items-center gap-1 text-[0.6875rem] font-medium " +
                        (row.status === "contact_first" ? "text-qualify" : "text-human")
                      }
                    >
                      <Circle aria-hidden className="h-1.5 w-1.5 fill-current" strokeWidth={0} />
                      {row.status === "contact_first" ? "Contact first" : "Review"}
                    </span>
                    <span className="t-data text-[0.6875rem] text-text-faint">Fit {row.fit}</span>
                  </div>
                  <p className="mt-1 truncate text-[0.8125rem] text-text-faint">{row.reason}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:min-w-[9.5rem] sm:justify-end">
                  {row.buyer ? (
                    <>
                      <span className="min-w-0 text-right leading-tight">
                        <span className="block truncate text-[0.75rem] font-medium text-text">
                          {row.buyer}
                        </span>
                        <span className="t-sys block truncate text-text-faint">
                          {row.buyerRole}
                        </span>
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-qualify-dim text-qualify ring-1 ring-qualify-edge/50 ring-inset">
                        <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </>
                  ) : (
                    <span className="t-sys text-right text-text-faint">{row.buyerRole}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
