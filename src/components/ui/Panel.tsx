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
 * The app's one container. The accent is a 2px rail inset inside the
 * rounded corner (a `::before`) rather than a `border-left`, so the corner
 * radius stays circular instead of collapsing into a flat edge on the
 * accented side.
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
        "surface relative overflow-hidden",
        padding === "sm" && "p-4",
        padding === "md" && "p-5 sm:p-6",
        padding === "lg" && "p-6 sm:p-8",
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

/** A small uppercase section label — the app's quietest typography. It names
 * a region without competing with the content inside it. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("t-label text-text-faint", className)}>{children}</p>;
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
        {title && <h2 className="t-h3 mt-1.5 text-text">{title}</h2>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
