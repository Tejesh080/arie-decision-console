/**
 * The page's light. Two fixed, pointer-transparent layers:
 *
 *   1. A cold radial pool behind the top of the page, so content near the
 *      header sits in light and the page bottom falls away into graphite.
 *   2. A single raking sweep across the upper third — one directional light
 *      source, the thing that separates "considered dark UI" from "black
 *      rectangle".
 *
 * Both are `position: fixed` on a pseudo-free element with no animation, so
 * they are painted once and never re-composited on scroll. Deliberately far
 * below the threshold where a gradient reads as decoration.
 */
export function AmbientField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[820px]"
        style={{
          background:
            "radial-gradient(1100px 520px at 50% -18%, rgba(77,141,255,0.10), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[900px]"
        style={{
          background:
            "linear-gradient(148deg, transparent 34%, rgba(255,255,255,0.028) 50%, transparent 62%)",
          maskImage: "linear-gradient(to bottom, black 55%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
        }}
      />
      {/* Hairline grid, fading out downward. Reads as graph paper under the
          content rather than as a visible pattern. */}
      <div
        className="absolute inset-x-0 top-0 h-[640px] opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "linear-gradient(to bottom, black, transparent 88%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 88%)",
        }}
      />
    </div>
  );
}
