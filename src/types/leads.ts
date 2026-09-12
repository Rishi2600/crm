// src/types/leads.ts
//
// ─── A note on naming ─────────────────────────────────────────────────────────
// The reference screenshots label a lead's pipeline position "Status" and its
// Hot/Warm/Cold grade "Lead Stage". This schema already uses those two words
// the other way round — `leadStage` IS the pipeline position (FRESH, CONVERTED,
// …) and `leadStatus` IS the temperature — and the Lead Insights KPI cards have
// counted by `leadStage` since the Dashboard module shipped.
//
// Renaming the columns to match a screenshot would have silently changed what
// every existing KPI card counts, so the fields keep their meanings and only
// the DISPLAY labels follow the reference:
//
//   UI "Status"       → Contact.leadStage      (Fresh / Interested / …)
//   UI "Sub-Status"   → Contact.leadSubStatus  (Untouched / Contacted / …)
//   UI "Temperature"  → Contact.leadStatus     (Hot / Warm / Cold)
//   UI "Source"       → Contact.leadSource + Contact.sourceName
//
// Everything below speaks in display labels; lib/leads.ts owns the translation
// to and from the enums, so no route or page ever handles a raw enum value.

export type LeadStatusLabel =
  | "Fresh"
  | "Interested"
  | "Converted"
  | "Closed"
  | "Irrelevant";

export type LeadSubStatusLabel =
  | "Untouched"
  | "Contacted"
  | "Not Reachable"
  | "Callback Requested"
  | "Proposal Sent"
  | "Negotiating"
  | "Won"
  | "Lost"
  | "Dropped"
  | "Junk"
  | "Duplicate"
  | "Out of Area";

export type LeadTemperatureLabel = "Hot" | "Warm" | "Cold";

export type LeadSourceLabel =
  | "Direct"
  | "Referral"
  | "Website"
  | "Campaign"
  | "Event"
  | "Other";

export type LeadHistoryTypeLabel =
  | "Created"
  | "Status Changed"
  | "Assigned"
  | "Remark Added"
  | "Details Updated"
  | "Follow-up Scheduled";

// ─── Rows ─────────────────────────────────────────────────────────────────────

/** One row in the Leads table. */
export interface LeadListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  location: string | null;
  status: LeadStatusLabel;
  subStatus: LeadSubStatusLabel;
  temperature: LeadTemperatureLabel;
  source: LeadSourceLabel;
  sourceName: string | null;
  leadScore: number;
  /** Whole days since the lead was created — the "Lead Age" card. */
  leadAge: number;
  reEnquiryCount: number;
  agentId: string;
  agentName: string;
  /** Soonest still-pending follow-up, or null when nothing is scheduled. */
  nextFollowUpAt: string | null;
  createdAt: string;
}

export interface LeadHistoryEntry {
  id: string;
  type: LeadHistoryTypeLabel;
  fromValue: string | null;
  toValue: string | null;
  remark: string | null;
  userName: string;
  createdAt: string;
}

/** The lead detail view — the list row plus everything only it shows. */
export interface LeadDetail extends LeadListItem {
  /** Most recent remark of any kind, for the "Last Lead Remark" panel. */
  lastRemark: LeadHistoryEntry | null;
  history: LeadHistoryEntry[];
  /** Assignment-only slice of the same timeline — the Assignment Trail. */
  assignmentTrail: LeadHistoryEntry[];
  lastFollowUpAt: string | null;
}

// ─── Summary ──────────────────────────────────────────────────────────────────
// The count strip under the KPI cards. Scoped and filtered like the list itself
// minus the status filter, so a pill count always matches what clicking it
// shows — the same rule the Follow-up page's pills follow.
export interface LeadSummary {
  total: number;
  fresh: number;
  interested: number;
  converted: number;
  closed: number;
  irrelevant: number;
  reEnquired: number;
}

export interface LeadsApiResponse {
  success: boolean;
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: LeadSummary;
  data: LeadListItem[];
}

export interface LeadDetailResponse {
  success: boolean;
  message: string;
  data: LeadDetail;
}

// ─── Write payloads ───────────────────────────────────────────────────────────

export interface CreateLeadPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  location?: string;
  status?: LeadStatusLabel;
  subStatus?: LeadSubStatusLabel;
  temperature?: LeadTemperatureLabel;
  source?: LeadSourceLabel;
  sourceName?: string;
  leadScore?: number;
  /** Defaults to the caller; only self / direct reports / anyone-if-admin. */
  ownerId?: string;
  remark?: string;
}

/** Every field the detail view lets an agent edit. Status and sub-status are
 *  NOT here on purpose — they go through /status, which demands a remark. */
export interface UpdateLeadPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  companyName?: string | null;
  location?: string | null;
  temperature?: LeadTemperatureLabel;
  source?: LeadSourceLabel;
  sourceName?: string | null;
  leadScore?: number;
  ownerId?: string;
}

/**
 * A status/sub-status change. `remark` is REQUIRED — this is the "lead
 * recording" an agent is prompted for every time a lead moves, so the timeline
 * never contains a transition nobody can explain.
 */
export interface ChangeLeadStatusPayload {
  status?: LeadStatusLabel;
  subStatus?: LeadSubStatusLabel;
  remark: string;
}

export interface AddRemarkPayload {
  remark: string;
}

// ─── Bulk CSV upload ──────────────────────────────────────────────────────────

/** One rejected CSV row. `row` is the record's real 1-based line number in the
 *  uploaded file, so the user can open the file and go straight to it. */
export interface BulkUploadRowError {
  row: number;
  name: string;
  reason: string;
}

export interface BulkUploadResponse {
  success: boolean;
  message: string;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
}
