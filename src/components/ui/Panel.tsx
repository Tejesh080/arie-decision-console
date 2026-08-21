import type { ReactNode } from "react";
import clsx from "clsx";

export function Panel({
  children,
  className,
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: "machine" | "human" | "qualify" | "reject" | "shadow";
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border bg-panel p-6",
        accent === "machine" && "border-l-2 border-l-machine",
        accent === "human" && "border-l-2 border-l-human",
        accent === "qualify" && "border-l-2 border-l-qualify",
        accent === "reject" && "border-l-2 border-l-reject",
        accent === "shadow" && "border-l-2 border-l-shadow",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-data text-[0.7rem] font-medium uppercase tracking-[0.16em] text-text-faint">
      {children}
    </p>
  );
}
