"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { askLeadCopilot } from "@/lib/api/copilot";
import type { LeadCopilotResponse } from "@/lib/api/types";
import { SUGGESTED_LEAD_PROMPTS } from "@/lib/format/copilot";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Panel";

/**
 * "Ask ARIE about this lead" — M7 Slice 6, Part AC. Read-only: a
 * researchability answer only ever describes whether more research could
 * help (Part R); it never triggers `POST /leads/{id}/research` itself — that
 * stays the existing `ResearchOption` action, one deliberate click away.
 */
export function AskArieAboutLead({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<LeadCopilotResponse | null>(null);
  const [error, setError] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setLoading(true);
    setError(false);
    try {
      setAnswer(await askLeadCopilot(leadId, trimmed));
    } catch {
      setError(true);
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="px-0">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
          Ask ARIE about this lead
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 surface-flat p-3">
      <Eyebrow>Ask ARIE about this lead</Eyebrow>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Why is this a good lead?"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg-sunken px-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none"
          maxLength={500}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={loading || !question.trim()}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
          Ask
        </Button>
      </form>

      {!answer && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_LEAD_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] text-text-faint transition-colors hover:border-border-loud hover:text-text-dim"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-reject">Couldn&apos;t reach ARIE — try again.</p>}

      {answer && <p className="mt-2.5 text-sm leading-relaxed text-text-dim">{answer.answer}</p>}
    </div>
  );
}
