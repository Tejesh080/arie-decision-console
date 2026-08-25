import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Eye,
  TriangleAlert,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import type { LeadStatus } from "@/lib/api/types";
import { statusLabel } from "@/lib/format";
import { toneForStatus } from "@/lib/format/decision";
import { Badge, type BadgeTone } from "./Badge";

/**
 * The single place a lead status becomes a visual.
 *
 * Every status carries an icon as well as a colour, so the state is legible
 * to a reader who cannot distinguish the hues — colour is never the only
 * channel. The icon set maps to the semantic *group* (see `toneForStatus`),
 * not to individual statuses, so a new backend status inherits a sane
 * default instead of silently rendering unlabelled.
 */
const GROUP_ICON: Record<BadgeTone, LucideIcon> = {
  qualify: CircleCheck,
  reject: CircleSlash,
  human: UserRoundCheck,
  shadow: Eye,
  pending: CircleDashed,
  machine: CircleDashed,
  neutral: CircleDashed,
};

const FAILURE_STATUSES = new Set<LeadStatus>(["FAILED", "DEAD_LETTER"]);

export function StatusPill({ status, size = "md" }: { status: LeadStatus; size?: "sm" | "md" }) {
  const tone = toneForStatus(status);
  // A failure shares the reject tone but must not wear the "rejected"
  // icon — being turned down and never finishing are different outcomes.
  const Icon = FAILURE_STATUSES.has(status) ? TriangleAlert : GROUP_ICON[tone];
  const shadow = tone === "shadow";

  return (
    <Badge tone={tone} variant={shadow ? "outline" : "solid"} size={size}>
      <Icon aria-hidden className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.25} />
      {statusLabel(status)}
    </Badge>
  );
}
