"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Command as CommandIcon,
  CornerDownLeft,
  FileStack,
  Gauge,
  Layers,
  MessageSquareText,
  Plug,
  Radar,
  Search,
  Settings,
  Sparkle,
  Target,
  UserPlus,
} from "lucide-react";
import clsx from "clsx";
import { SPRING_SNAP } from "@/lib/motion";
import { tapHaptic } from "@/lib/haptics";

/**
 * ⌘K over the routes that actually exist.
 *
 * Every entry here navigates somewhere real — nothing in this list is a
 * placeholder for a feature that hasn't been built, because a command
 * palette full of dead ends is worse than no palette at all.
 */
type Command = {
  href: string;
  label: string;
  hint: string;
  group: "Do" | "Configure";
  keywords: string;
  icon: typeof Radar;
};

const COMMANDS: Command[] = [
  {
    href: "/discover",
    label: "Find customers",
    hint: "Search the market for companies worth contacting",
    group: "Do",
    keywords: "discover opportunities search market prospect",
    icon: Radar,
  },
  {
    href: "/leads/new",
    label: "Evaluate a lead",
    hint: "Check one company or contact you already have",
    group: "Do",
    keywords: "new lead evaluate single check upload",
    icon: UserPlus,
  },
  {
    href: "/ask",
    label: "Ask ARIE",
    hint: "A question in plain English about your leads",
    group: "Do",
    keywords: "ask question chat query copilot",
    icon: MessageSquareText,
  },
  {
    href: "/batches",
    label: "History",
    hint: "Past runs and uploaded batches",
    group: "Do",
    keywords: "batches history runs past uploads",
    icon: FileStack,
  },
  {
    href: "/targeting",
    label: "Targeting",
    hint: "What you sell and who should care",
    group: "Configure",
    keywords: "targeting profile audience icp setup",
    icon: Target,
  },
  {
    href: "/icp",
    label: "Ideal customer profile",
    hint: "The scoring profile in full detail",
    group: "Configure",
    keywords: "icp profile scoring rules advanced",
    icon: Layers,
  },
  {
    href: "/providers",
    label: "Providers",
    hint: "Your own data-provider keys",
    group: "Configure",
    keywords: "providers keys byok api credentials",
    icon: Plug,
  },
  {
    href: "/usage",
    label: "Usage",
    hint: "What you've run and what it cost",
    group: "Configure",
    keywords: "usage billing cost spend limits",
    icon: Gauge,
  },
  {
    href: "/onboarding",
    label: "Onboarding",
    hint: "Finish setting ARIE up",
    group: "Configure",
    keywords: "onboarding setup checklist start",
    icon: Sparkle,
  },
  {
    href: "/settings",
    label: "Settings",
    hint: "Organization, members and invitations",
    group: "Configure",
    keywords: "settings organization members team invite",
    icon: Settings,
  },
];

function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

/** The dock's trigger. Shows the shortcut so it's discoverable without a
 * tour, and collapses to just the icon on narrow screens. */
export function CommandLauncher() {
  const { open, setOpen } = useCommandPalette();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tapHaptic();
          setOpen(true);
        }}
        aria-label="Open command palette"
        className={clsx(
          "group flex h-9 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] pr-2 pl-3 text-text-dim",
          "transition-colors duration-[140ms] hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-text",
        )}
      >
        <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span className="hidden text-[0.8125rem] md:inline">Search</span>
        <kbd
          aria-hidden
          className="t-data hidden items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[0.625rem] text-text-faint md:inline-flex"
        >
          <CommandIcon className="h-2.5 w-2.5" strokeWidth={2.5} />K
        </kbd>
      </button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const q = query.trim().toLowerCase();
  const results = q
    ? COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q) || c.hint.toLowerCase().includes(q),
      )
    : COMMANDS;

  // Reset per-open rather than in an effect chain: derived from `open`
  // during render is cheaper than an open-then-corrected extra pass.
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    setQuery("");
    setActive(0);
  }
  if (active >= results.length && results.length > 0) setActive(0);

  const run = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[active];
      if (target) run(target.href);
    }
  }

  let renderedGroup: string | null = null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <button
            type="button"
            aria-label="Close command palette"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[rgba(4,5,8,0.88)]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={onKeyDown}
            initial={reduced ? false : { opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.99 }}
            transition={SPRING_SNAP}
            className={clsx(
              "relative w-full max-w-[36rem] overflow-hidden rounded-2xl border border-white/[0.08]",
              "bg-[rgba(19,22,31,0.985)] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl",
            )}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              <Search aria-hidden className="h-4 w-4 shrink-0 text-text-faint" strokeWidth={2.25} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ARIE…"
                aria-label="Search commands"
                className="h-14 w-full border-0 bg-transparent text-[0.9375rem] text-text outline-none placeholder:text-text-faint"
              />
            </div>

            <div className="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-text-faint">
                  Nothing matches “{query}”.
                </p>
              ) : (
                results.map((command, i) => {
                  const Icon = command.icon;
                  const isActive = i === active;
                  const newGroup = command.group !== renderedGroup;
                  renderedGroup = command.group;
                  return (
                    <div key={command.href}>
                      {newGroup && (
                        <p className="px-3 pt-3 pb-1.5 text-[0.6875rem] font-medium tracking-[0.06em] text-text-faint uppercase">
                          {command.group}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => run(command.href)}
                        onPointerEnter={() => setActive(i)}
                        className={clsx(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-[120ms]",
                          isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                        )}
                      >
                        <span
                          className={clsx(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                            isActive
                              ? "border-qualify-edge bg-qualify-dim text-qualify"
                              : "border-white/[0.07] bg-white/[0.03] text-text-dim",
                          )}
                        >
                          <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text">
                            {command.label}
                          </span>
                          <span className="block truncate text-xs text-text-faint">
                            {command.hint}
                          </span>
                        </span>
                        {isActive ? (
                          <CornerDownLeft
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 text-text-faint"
                            strokeWidth={2}
                          />
                        ) : (
                          <ArrowRight
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 text-transparent"
                            strokeWidth={2}
                          />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
