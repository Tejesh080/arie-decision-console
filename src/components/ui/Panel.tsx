import type { ReactNode } from "react";
import clsx from "clsx";

export type PanelAccent = "machine" | "human" | "qualify" | "reject" | "shadow";

const ACCENT_RAIL: Record<PanelAccent, string> = {
  machine: "before:bg-machine",
  human: "before:bg-human",
  qualify: "before:bg-qualify",
  reject: "before:bg-reject",
  shadow: "before:bg-shadow-role",
};

/**
 * The app's one container: a raised, edge-lit island. The separation from
 * the page comes from the luminance step and the light on its top rim, not
 * from a drawn box — which is why there is no border here.
 *
 * The accent is a 2px rail inset inside the rounded corner (a `::before`)
 * rather than a `border-left`, so the corner radius stays circular instead
 * of collapsing into a flat edge on the accented side.
 */
export function Panel({
  children,
  className,
  accent,
  padding = "md",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  accent?: PanelAccent;
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={clsx(
        "island relative overflow-hidden",
        padding === "sm" && "p-5",
        padding === "md" && "p-6 sm:p-7",
        padding === "lg" && "p-7 sm:p-9",
        accent && [
          "before:absolute before:top-0 before:bottom-0 before:left-0 before:w-[2px] before:content-['']",
          ACCENT_RAIL[accent],
        ],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * A small section label. Editorial small-caps rather than the old mono
 * all-caps: it names a region without shouting across the screen, and it
 * doesn't borrow the machine voice that evidence and identifiers use.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={clsx(
        "text-[0.6875rem] font-semibold tracking-[0.11em] text-text-faint uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Header row for a panel: eyebrow + optional trailing control. */
export function PanelHeader({
  eyebrow,
  title,
  trailing,
  className,
}: {
  eyebrow?: string;
  title?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {title && <h2 className="t-h3 mt-2 text-text">{title}</h2>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
