export type DataMode = "mock" | "api";

/**
 * Explicit, env-driven — never inferred by silently falling back after a
 * failed real request. "mock" is the safe default when unset, so cloning
 * this repo and running `npm run dev` with no `.env.local` just works with
 * no Docker required.
 */
export function getDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_ARIE_DATA_MODE === "api" ? "api" : "mock";
}
