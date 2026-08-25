/**
 * The ARIE mark: a threshold glyph.
 *
 * A track of accumulating evidence runs left to right, meets the autonomy
 * threshold (the vertical bar), and one marker has crossed it. That is
 * literally the product's whole thesis — keep gathering, or has enough
 * been gathered to act? — reduced to four strokes.
 *
 * Deliberately not a brain, a robot, or a sparkle.
 */
export function Mark({ className, crossed = true }: { className?: string; crossed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Evidence track */}
      <path d="M3 12h11" stroke="currentColor" strokeWidth="1.75" opacity="0.4" />
      {/* Autonomy threshold */}
      <path d="M15 4.5v15" stroke="currentColor" strokeWidth="1.75" opacity="0.75" />
      {/* The marker, past the threshold when the decision cleared it */}
      <circle
        cx={crossed ? 19.5 : 10}
        cy="12"
        r="2.5"
        fill="currentColor"
        className="text-machine"
      />
    </svg>
  );
}

/** Full lockup for the header: mark + wordmark + product descriptor. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2.5">
        <Mark className="h-[22px] w-[22px] text-text" />
        <span className="flex items-baseline gap-2">
          <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-text">ARIE</span>
          <span className="t-label hidden text-text-faint sm:inline">Decision Console</span>
        </span>
      </span>
    </span>
  );
}
