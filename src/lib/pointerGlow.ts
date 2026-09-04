import type { PointerEvent } from "react";

/**
 * Writes pointer position straight to the element's own `--px`/`--py`
 * custom properties (read by `.liquid-surface`, `.btn-glow` etc in
 * globals.css) instead of through React state — a card's local light must
 * never trigger a component re-render on every `pointermove`.
 *
 * Plain event handlers rather than a hook that hands back a ref: the
 * element is read straight off `event.currentTarget`, so nothing here needs
 * to store or return a ref across a hook boundary — which the project's
 * React Compiler lint rules disallow (a custom Hook returning a ref creates
 * coupling the compiler can't verify).
 */
export function pointerGlowMove(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--px", `${((event.clientX - rect.left) / rect.width) * 100}%`);
  el.style.setProperty("--py", `${((event.clientY - rect.top) / rect.height) * 100}%`);
}

export function pointerGlowLeave(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--px", "50%");
  event.currentTarget.style.setProperty("--py", "40%");
}
