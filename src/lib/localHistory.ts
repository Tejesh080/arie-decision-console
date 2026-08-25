/**
 * A browser-local record of leads submitted from this device — not a
 * server-side lead list (the backend exposes no such endpoint; none is
 * invented here). Purely a convenience for finding your way back to a
 * receipt you just looked at.
 */

export interface RecentLeadEntry {
  lead_id: string;
  label: string;
  email: string;
  submitted_at: string;
  /** Optional so entries saved before this field existed still parse. */
  is_shadow?: boolean;
  /** Company name or domain as submitted, for a human card line. */
  company?: string;
  /**
   * Snapshot of the decided receipt, written when this browser loads it —
   * display-only convenience for the activity cards. Live status still comes
   * from `GET /leads/{id}` each render; this never overrides it.
   */
  outcome?: string;
  confidence?: number;
}

const KEY = "arie-web:recent-leads:v1";
const MAX_ENTRIES = 20;

export function getRecentLeads(): RecentLeadEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentLeadEntry[]) : [];
  } catch {
    return [];
  }
}

export function addRecentLead(entry: RecentLeadEntry): void {
  if (typeof window === "undefined") return;
  const existing = getRecentLeads().filter((e) => e.lead_id !== entry.lead_id);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

/**
 * Patch an existing entry in place (no-op if the lead isn't remembered
 * here). Used to attach the decided outcome/confidence snapshot once a
 * receipt has been seen, without disturbing the entry's position.
 */
export function updateRecentLead(leadId: string, patch: Partial<RecentLeadEntry>): void {
  if (typeof window === "undefined") return;
  const entries = getRecentLeads();
  const index = entries.findIndex((e) => e.lead_id === leadId);
  if (index === -1) return;
  entries[index] = { ...entries[index], ...patch, lead_id: leadId };
  window.localStorage.setItem(KEY, JSON.stringify(entries));
}

export function clearRecentLeads(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
