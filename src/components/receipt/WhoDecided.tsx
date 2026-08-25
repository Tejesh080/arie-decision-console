import type { ReceiptResponse } from "@/lib/api/types";
import { Cpu, Eye } from "lucide-react";
import { Eyebrow } from "@/components/ui/Panel";

/**
 * Names who is accountable for this lead, for the cases where nobody is asked.
 *
 * When a person *was* involved the machine -> human -> final chain renders
 * instead, and says far more. This exists so the autonomous and shadow cases
 * still answer the same question rather than leaving a reader to infer from an
 * absence that no human was involved — an absence reads as an omission.
 */
export function WhoDecided({ receipt }: { receipt: ReceiptResponse }) {
  const shadow = receipt.shadow;
  const Icon = shadow ? Eye : Cpu;

  return (
    <div className="surface-flat flex items-start gap-3 p-5">
      <Icon
        aria-hidden
        className={
          shadow
            ? "mt-0.5 h-4 w-4 shrink-0 text-shadow-role"
            : "mt-0.5 h-4 w-4 shrink-0 text-machine"
        }
        strokeWidth={2}
      />
      <div className="min-w-0">
        <Eyebrow>Who decided</Eyebrow>
        <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
          {shadow ? (
            <>
              Nobody — and nothing was decided. ARIE produced a recommendation and stopped there,
              which is the whole point of shadow mode. A lead run normally would either be routed
              automatically or sent to a person.
            </>
          ) : (
            <>
              <strong className="font-medium text-text">ARIE, on its own.</strong> Confidence
              cleared the autonomy threshold, so no human was asked. Had it fallen short, the lead
              would have gone to a reviewer and this receipt would show their decision alongside
              ARIE&apos;s recommendation.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
