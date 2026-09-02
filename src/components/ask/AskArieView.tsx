"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { askCopilot } from "@/lib/api/copilot";
import type { CopilotLeadReference, CopilotResponse } from "@/lib/api/types";
import { priorityLabel, priorityTone } from "@/lib/format/recommendation";
import { copilotIntentLabel, SUGGESTED_LIST_PROMPTS } from "@/lib/format/copilot";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eyebrow, Panel } from "@/components/ui/Panel";

/**
 * "I uploaded leads and now I can just ask what to do" — M7 Slice 6's whole
 * point. A single question -> one answer is enough; this is deliberately not
 * a multi-turn chat. See `arie.copilot_service`'s own module docstring for
 * why the model behind this never sees the database or writes SQL.
 */
export function AskArieView() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [error, setError] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setLoading(true);
    setError(false);
    try {
      setResult(await askCopilot(trimmed));
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-5 py-10 sm:px-8 sm:py-12">
      <div>
        <Eyebrow>Ask ARIE</Eyebrow>
        <h1 className="t-h1 mt-1.5 text-text">What should I work on?</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-dim">
          Ask a plain-English question about your leads, targeting, and recommendations. ARIE
          answers from what it has already decided — nothing here re-scores a lead.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
        className="surface-flat flex items-center gap-2 p-2"
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What should I work on today?"
          className="h-9.5 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none"
          maxLength={500}
        />
        <Button type="submit" variant="primary" size="md" disabled={loading || !question.trim()}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
          ) : (
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
          Ask
        </Button>
      </form>

      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_LIST_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              className="surface-flat rounded-full px-3.5 py-1.5 text-xs text-text-dim transition-colors hover:border-border-loud hover:text-text"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {error && (
        <Panel accent="reject" padding="sm">
          <p className="text-sm text-text-dim">
            Couldn&apos;t reach ARIE for that question — try again.
          </p>
        </Panel>
      )}

      {result && <CopilotAnswer result={result} />}
    </div>
  );
}

function CopilotAnswer({ result }: { result: CopilotResponse }) {
  return (
    <Panel padding="lg">
      <Eyebrow>{copilotIntentLabel(result.intent)}</Eyebrow>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-text">{result.answer}</p>

      {result.leads.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
          {result.leads.map((lead) => (
            <CopilotLeadRow key={lead.lead_id} lead={lead} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CopilotLeadRow({ lead }: { lead: CopilotLeadReference }) {
  return (
    <li>
      <Link
        href={`/leads/${lead.lead_id}`}
        className="group surface-flat flex items-center justify-between gap-4 p-3.5 transition-colors hover:border-border-loud hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone={priorityTone(lead.priority)} size="sm">
              {priorityLabel(lead.priority)}
            </Badge>
            <p className="truncate text-sm font-medium text-text">
              {lead.company ?? lead.contact ?? "Lead"}
            </p>
          </div>
          <p className="mt-1 truncate text-xs text-text-dim">{lead.why}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {lead.score !== null && (
            <span className="t-data text-sm text-text-dim">{lead.score.toFixed(1)}</span>
          )}
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 text-text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            strokeWidth={2}
          />
        </div>
      </Link>
    </li>
  );
}
