/**
 * A single short tap, for the couple of touch interactions that stand in for
 * a physical toggle (opening/closing a nav sheet). Deliberately minimal and
 * rare: overusing vibration feedback is worse than not having it.
 *
 * No-ops silently where unsupported — iOS Safari never implemented the
 * Vibration API at all, and that's fine; this is a bonus for the platforms
 * that do, never something a flow depends on.
 */
export function tapHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
}
