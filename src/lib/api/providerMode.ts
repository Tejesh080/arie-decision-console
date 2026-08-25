export type ProviderMode = "simulated" | "live";

/**
 * How the backend this UI is pointed at sources provider data.
 *
 * The backend does *not* expose its provider mode over HTTP (`/healthz`
 * returns only status/database/schema_ready), so the frontend cannot detect
 * this — it has to be told. The default here is `"simulated"`, which mirrors
 * the backend's own default exactly (`config.py`:
 * `os.getenv("PROVIDER_MODE", "simulated")`), so the two agree unless
 * someone deliberately changes both.
 *
 * This exists purely so cost figures can be *labelled honestly*. Under
 * `simulated`, the numbers on a receipt are what the configured provider
 * rates would have cost against a frozen corpus — real ledger arithmetic
 * over modelled prices, not money anyone was billed. Calling that "spend"
 * would be the single most misleading thing this UI could say.
 */
export function getProviderMode(): ProviderMode {
  return process.env.NEXT_PUBLIC_ARIE_PROVIDER_MODE === "live" ? "live" : "simulated";
}

export function isSimulated(): boolean {
  return getProviderMode() === "simulated";
}

/** The noun to use for a cost figure, given the current provider mode. */
export function costNoun(): string {
  return isSimulated() ? "Modeled provider cost" : "Provider cost";
}

/** Short form for tight spaces (stat labels, table headers). */
export function costNounShort(): string {
  return isSimulated() ? "Modeled cost" : "Provider cost";
}

/** The sentence that qualifies every cost figure on a receipt. */
export function costCaveat(): string {
  return isSimulated()
    ? "Configured provider rates replayed against the frozen evaluation corpus. Real ledger arithmetic over modelled prices — not billed vendor spend."
    : "Recorded by ARIE's cost ledger from live provider calls.";
}

/** Word for a provider interaction — "event" under simulation, since no
 * outbound vendor request was actually made. */
export function callNoun(plural = false): string {
  if (isSimulated()) return plural ? "simulated provider events" : "simulated provider event";
  return plural ? "provider calls" : "provider call";
}
