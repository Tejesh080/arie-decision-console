/**
 * The hero's mesh-gradient backdrop — three overlapping colour pools
 * (mint, cyan, violet) rather than one flat vignette, the way most current
 * Framer-marketplace heroes build an "aurora" without a real blur filter:
 * pure `radial-gradient` layering composites for free, where a large
 * `filter: blur()` would not.
 *
 * Contained to the hero's own box (never `position: fixed`, never
 * viewport-sized) and masked so it concentrates around the headline instead
 * of washing the whole page.
 */
export function HeroAurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-[18%] left-[6%] h-[520px] w-[620px] opacity-80"
        style={{
          background:
            "radial-gradient(closest-side, rgba(79,227,193,0.32), rgba(79,227,193,0.08) 55%, transparent 78%)",
        }}
      />
      <div
        className="absolute top-[2%] right-[2%] h-[460px] w-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, rgba(89,216,255,0.24), rgba(89,216,255,0.05) 55%, transparent 78%)",
        }}
      />
      <div
        className="absolute top-[30%] left-[32%] h-[420px] w-[480px] opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(158,134,255,0.18), transparent 72%)",
        }}
      />
      {/* Grain keeps the gradient from banding and gives it the same
          textured, "designed" surface as the rest of the app. */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Fade to the page colour at the bottom so the aurora reads as
          light in a room, not a hard-edged panel. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: "linear-gradient(to bottom, transparent, var(--bg))" }}
      />
    </div>
  );
}
