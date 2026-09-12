// src/types/followups.ts

// ─── Display status ───────────────────────────────────────────────────────────
// Only PENDING / COMPLETED / MISSED / CANCELLED are stored. "Planned" vs
// "Pending" is derived by comparing a PENDING row's scheduledAt to now —
// a follow-up whose time hasn't come yet is planned, one whose time has
// passed is pending action. Deriving it means a planned follow-up becomes
// pending on its own as the clock passes, with no job to run.
export type FollowUpDisplayStatus = "Planned" | "Pending" | "Done" | "Missed" | "Cancelled";

// The pill filters across the top of the Follow-up page.
// 🚩 "rescheduled" is NOT part of the same partition as the others — a
// rescheduled follow-up is still planned/done/missed as well. It's a
// cross-cutting filter (rescheduleCount > 0), which is why the pill counts
// deliberately don't sum to Total.
export type FollowUpFilter =
  | "all"
  | "planned"
  | "pending"
  | "done"
  | "missed"
  | "cancelled"
  | "rescheduled";

export const FOLLOW_UP_OUTCOMES = [
  "Connected",
  "Not Connected",
  "Interested",
  "Not Interested",
  "Callback Requested",
  "Converted",
] as const;

export type FollowUpOutcomeLabel = (typeof FOLLOW_UP_OUTCOMES)[number];

// ─── Rows ─────────────────────────────────────────────────────────────────────

export interface FollowUpResponse {
  id: string;
  contactId: string;
  contactName: string;
  company: string | null;
  dealTitle: string | null;
  /** The agent who owns the follow-up — "set by" in the UI. */
  agentName: string;
  /** Full ISO timestamp; the list shows both date and time. */
  scheduledAt: string;
  completedAt: string | null;
  status: FollowUpDisplayStatus;
  outcome: FollowUpOutcomeLabel | null;
  notes: string | null;
  rescheduleCount: number;
  isOverdue: boolean;
}

// ─── Summary counts ───────────────────────────────────────────────────────────
// Scoped and filtered exactly like the list itself (minus the status filter),
// so the pill counts always describe the rows the current filters can reach.
export interface FollowUpSummary {
  total: number;
  planned: number;
  pending: number;
  done: number;
  missed: number;
  cancelled: number;
  rescheduled: number;
}

export interface FollowUpsApiResponse {
  success: boolean;
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: FollowUpSummary;
  data: FollowUpResponse[];
}

// ─── Write payloads ───────────────────────────────────────────────────────────

export interface CreateFollowUpPayload {
  contactId: string;
  dealId?: string;
  /** "YYYY-MM-DD" */
  scheduledDate: string;
  /** "HH:mm" — defaults to 09:00 when omitted. */
  scheduledTime?: string;
  notes?: string;
  /** Defaults to the caller; only self / direct reports / anyone-if-admin. */
  ownerId?: string;
}

export interface CreateFollowUpResponse {
  success: boolean;
  message: string;
  data: FollowUpResponse;
}

/**
 * All three actions a follow-up supports, in one PATCH:
 *  - mark it Done (optionally with an outcome)
 *  - mark it Missed / Cancelled
 *  - reschedule it by sending a new date (bumps rescheduleCount)
 */
export interface UpdateFollowUpPayload {
  status?: Exclude<FollowUpDisplayStatus, "Planned">;
  outcome?: FollowUpOutcomeLabel;
  notes?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

export interface AgentOption {
  id: string;
  name: string;
}
