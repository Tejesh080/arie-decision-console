import type { IngestLeadRequest } from "@/lib/api/types";

/**
 * The three outcomes ARIE can reach, each as a one-click example.
 *
 * These identities come from the frozen evaluation corpus, which
 * `PROVIDER_MODE=simulated` replays rather than samples — so each one resolves
 * the same way every time. That determinism is the only reason it is honest to
 * print the outcome on the button before running it.
 */
export type DemoExampleId = "autonomous" | "review" | "shadow";

export interface DemoExample {
  id: DemoExampleId;
  /** What ARIE ends up doing. Deterministic, per the corpus note above. */
  outcome: string;
  headline: string;
  blurb: string;
  tone: "qualify" | "human" | "shadow";
  lead: Omit<IngestLeadRequest, "external_ref">;
}

const DELACROIX = {
  source: "arie-web",
  email: "nadia.delacroix@lumen500.com",
  full_name: "Nadia Delacroix",
  company_domain: "lumen500.com",
} as const;

const HADDAD = {
  source: "arie-web",
  email: "nadia.haddad@cobalt500.com",
  full_name: "Nadia Haddad",
  company_domain: "cobalt500.com",
  company_name: "Cobalt500 Ltd",
} as const;

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    id: "autonomous",
    outcome: "Decides on its own",
    headline: "Confident enough to act",
    blurb:
      "Most of the evidence is already cached, so ARIE reaches its confidence threshold cheaply and routes the lead without asking anyone.",
    tone: "qualify",
    lead: { ...DELACROIX, mode: "normal" },
  },
  {
    id: "review",
    outcome: "Asks a human",
    headline: "Not confident enough",
    blurb:
      "Evidence stays thin and one provider fails. ARIE runs out of things worth buying, stops short of deciding, and hands the call to a person.",
    tone: "human",
    lead: { ...HADDAD, mode: "normal" },
  },
  {
    id: "shadow",
    outcome: "Watches without acting",
    headline: "Shadow evaluation",
    blurb:
      "ARIE computes the whole recommendation and then does nothing with it — for running alongside an existing workflow to see what it would have done.",
    tone: "shadow",
    lead: { ...DELACROIX, mode: "shadow" },
  },
];

export function findExample(id: string | null | undefined): DemoExample | undefined {
  return DEMO_EXAMPLES.find((e) => e.id === id);
}

/** A fresh reference per run, so an example always creates a new lead rather
 * than returning the previous one through ARIE's own idempotency. */
export function freshExternalRef(prefix = "web"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
