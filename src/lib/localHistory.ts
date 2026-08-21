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

export function clearRecentLeads(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
