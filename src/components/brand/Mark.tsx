import clsx from "clsx";

/**
 * The ARIE mark: convergence.
 *
 * Two evidence paths arrive from the left and resolve into a single lit
 * point — many weak signals about a market becoming one thing worth acting
 * on. That is the whole product in four strokes.
 *
 * Deliberately not a brain, a robot, a sparkle, or a node graph.
 */
export function Mark({
  className,
  live = true,
}: {
  className?: string;
  /** `false` dims the resolved point — used where nothing has resolved yet
   * (empty states), so the mark tells the truth about the screen. */
  live?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Evidence paths converging */}
      <path
        d="M2.5 6.5C7.5 6.5 9.5 11 13 12"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.45"
      />
      <path
        d="M2.5 17.5C7.5 17.5 9.5 13 13 12"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.45"
      />
      {/* The resolved signal */}
      <circle
        cx="17.5"
        cy="12"
        r="4.6"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={live ? 0.32 : 0.16}
      />
      <circle cx="17.5" cy="12" r="2.4" className={live ? "fill-qualify" : "fill-text-faint"} />
    </svg>
  );
}

/**
 * Full lockup for the header. The descriptor names what ARIE does now —
 * watching signals — rather than the enrichment mechanism it was built on.
 */
export function Wordmark({
  className,
  descriptor = true,
}: {
  className?: string;
  descriptor?: boolean;
}) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <Mark className="h-[21px] w-[21px] text-text" />
      <span className="flex items-baseline gap-2">
        <span className="text-[0.9375rem] font-semibold tracking-[-0.03em] text-text">ARIE</span>
        {descriptor && (
          <span className="hidden text-[0.6875rem] font-medium tracking-[0.06em] text-text-faint sm:inline">
            Signal Intelligence
          </span>
        )}
      </span>
    </span>
  );
}
