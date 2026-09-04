/**
 * The page's light.
 *
 * Four fixed, pointer-transparent layers that together make the background
 * read as a lit space rather than a black rectangle:
 *
 *   1. A cool signal pool behind the top of the page — the light ARIE's own
 *      accent casts into the room.
 *   2. A warmer counter-light from the right, so the illumination has a
 *      direction instead of being a symmetric vignette.
 *   3. One raking sweep across the upper third: a single directional light
 *      source is the thing that separates "considered dark UI" from "black".
 *   4. A lattice — the market ARIE watches, drawn as a field of faint
 *      points that fades out as the page goes on.
 *
 * All of it is gradient math on `position: fixed` elements with no
 * animation and no `filter`. It paints once and is never re-composited on
 * scroll, which is exactly what a large blurred layer failed to do.
 */
export function AmbientField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* 1 — signal pool, top centre-left */}
      <div
        className="absolute inset-x-0 top-0 h-[900px]"
        style={{
          background:
            "radial-gradient(1200px 620px at 38% -12%, rgba(79,227,193,0.18), rgba(79,227,193,0.05) 42%, transparent 72%)",
        }}
      />
      {/* 2 — beam counter-light, upper right */}
      <div
        className="absolute inset-x-0 top-0 h-[900px]"
        style={{
          background:
            "radial-gradient(900px 520px at 88% 2%, rgba(108,140,255,0.19), transparent 68%)",
        }}
      />
      {/* 3 — raking sweep */}
      <div
        className="absolute inset-x-0 top-0 h-[1000px]"
        style={{
          background:
            "linear-gradient(152deg, transparent 30%, rgba(255,255,255,0.045) 48%, transparent 64%)",
          maskImage: "linear-gradient(to bottom, black 50%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent)",
        }}
      />
      {/* 4 — the market lattice: points, not a grid of boxes */}
      <div
        className="absolute inset-x-0 top-0 h-[820px] opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(154,164,180,0.16) 1px, transparent 0)",
          backgroundSize: "38px 38px",
          maskImage:
            "radial-gradient(1100px 620px at 45% 6%, black, rgba(0,0,0,0.35) 55%, transparent 82%)",
          WebkitMaskImage:
            "radial-gradient(1100px 620px at 45% 6%, black, rgba(0,0,0,0.35) 55%, transparent 82%)",
        }}
      />
      {/* 5 — floor: the page darkens as it goes down, so content lower in
          a long page sits deeper in the room rather than floating in the
          same flat void as the hero. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70vh]"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(4,5,8,0.55))",
        }}
      />
    </div>
  );
}
