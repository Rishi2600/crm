// src/lib/leads.ts
// Label ↔ enum translation and the stage/sub-status rule for the Leads module.
//
// Every route and page in the module speaks display labels ("Fresh",
// "Not Reachable") and never raw enum values. Keeping both directions of that
// translation in ONE file is what stops the Sub-Status dropdown and the
// validation that rejects a bad pair from ever disagreeing: the dropdown is
// built from the same map the validator checks against.
//
// Naming: see the header of @/types/leads for why UI "Status" is the
// `leadStage` column and UI "Temperature" is the `leadStatus` column.
//
// 🚩 This module is PURE and must stay that way — no prisma, no server-only
// imports. Both Leads pages are client components and they read
// SUB_STATUS_BY_STATUS from here to build their dropdowns, so anything this
// file imports is bundled into the browser. Importing prisma here pulled its
// browser shim into the client bundle and added roughly half a megabyte of
// dead code to the page. Anything that needs the database lives in
// @/lib/leads.server instead.

import {
  LeadStatusLabel,
  LeadSubStatusLabel,
  LeadTemperatureLabel,
  LeadSourceLabel,
  LeadHistoryTypeLabel,
  LeadListItem,
  LeadHistoryEntry,
} from "@/types/leads";

// ─── Status (Contact.leadStage) ───────────────────────────────────────────────

export const STATUS_LABEL: Record<string, LeadStatusLabel> = {
  FRESH: "Fresh",
  INTERESTED: "Interested",
  CONVERTED: "Converted",
  CLOSED: "Closed",
  IRRELEVANT: "Irrelevant",
};

export const LABEL_TO_STATUS: Record<string, string> = invert(STATUS_LABEL);

// ─── Sub-status (Contact.leadSubStatus) ───────────────────────────────────────

export const SUB_STATUS_LABEL: Record<string, LeadSubStatusLabel> = {
  UNTOUCHED: "Untouched",
  CONTACTED: "Contacted",
  NOT_REACHABLE: "Not Reachable",
  CALLBACK_REQUESTED: "Callback Requested",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATING: "Negotiating",
  WON: "Won",
  LOST: "Lost",
  DROPPED: "Dropped",
  JUNK: "Junk",
  DUPLICATE: "Duplicate",
  OUT_OF_AREA: "Out of Area",
};

export const LABEL_TO_SUB_STATUS: Record<string, string> = invert(SUB_STATUS_LABEL);

/**
 * Which sub-statuses are legal under each status.
 *
 * 🚩 This is the module's one real business rule, and it lives here rather
 * than in the database because it changes on a product manager's timescale,
 * not a migration's. Every entry's FIRST value is the default the lead falls
 * to when its status changes and the caller didn't name a sub-status — which
 * is why "Untouched" leads Fresh and "Won" is alone under Converted.
 */
export const SUB_STATUS_BY_STATUS: Record<LeadStatusLabel, LeadSubStatusLabel[]> = {
  Fresh: ["Untouched", "Contacted", "Not Reachable"],
  Interested: ["Callback Requested", "Proposal Sent", "Negotiating"],
  Converted: ["Won"],
  Closed: ["Lost", "Dropped"],
  Irrelevant: ["Junk", "Duplicate", "Out of Area"],
};

/** The sub-status a lead lands on when it moves to `status` unaccompanied. */
export function defaultSubStatusFor(status: LeadStatusLabel): LeadSubStatusLabel {
  return SUB_STATUS_BY_STATUS[status][0];
}

/** True when the pair is one the UI would actually offer. */
export function isValidPair(status: LeadStatusLabel, subStatus: LeadSubStatusLabel): boolean {
  return SUB_STATUS_BY_STATUS[status]?.includes(subStatus) ?? false;
}

// ─── Temperature (Contact.leadStatus) ─────────────────────────────────────────

export const TEMPERATURE_LABEL: Record<string, LeadTemperatureLabel> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
};

export const LABEL_TO_TEMPERATURE: Record<string, string> = invert(TEMPERATURE_LABEL);

// ─── Source (Contact.leadSource) ──────────────────────────────────────────────

export const SOURCE_LABEL: Record<string, LeadSourceLabel> = {
  DIRECT: "Direct",
  REFERRAL: "Referral",
  WEBSITE: "Website",
  CAMPAIGN: "Campaign",
  EVENT: "Event",
  OTHER: "Other",
};

export const LABEL_TO_SOURCE: Record<string, string> = invert(SOURCE_LABEL);

// ─── History ──────────────────────────────────────────────────────────────────

export const HISTORY_TYPE_LABEL: Record<string, LeadHistoryTypeLabel> = {
  CREATED: "Created",
  STATUS_CHANGED: "Status Changed",
  ASSIGNED: "Assigned",
  REMARK_ADDED: "Remark Added",
  DETAILS_UPDATED: "Details Updated",
  FOLLOW_UP_SCHEDULED: "Follow-up Scheduled",
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

export const MIN_LEAD_SCORE = 0;
export const MAX_LEAD_SCORE = 100;

/** Returns the clamped score, or undefined when the input isn't a usable
 *  number — callers turn that into a 400 rather than storing NaN. */
export function parseLeadScore(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.min(MAX_LEAD_SCORE, Math.max(MIN_LEAD_SCORE, Math.round(n)));
}

// ─── Derived values ───────────────────────────────────────────────────────────

/** Whole days between a lead's creation and now — the "Lead Age" card.
 *  Derived on every read rather than stored, so it can't go stale overnight. */
export function leadAgeDays(createdAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// ─── Shaping ──────────────────────────────────────────────────────────────────

/** The `select` every lead read uses. Shared so the list and the detail view
 *  can never drift into showing different values for the same lead. */
export const leadSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  location: true,
  leadStage: true,
  leadSubStatus: true,
  leadStatus: true,
  leadSource: true,
  sourceName: true,
  leadScore: true,
  reEnquiryCount: true,
  createdAt: true,
  company: { select: { companyName: true } },
  owner: { select: { id: true, name: true } },
} as const;

export function shapeLead(
  c: any,
  nextFollowUpAt: Date | null,
  now: Date = new Date()
): LeadListItem {
  return {
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    email: c.email,
    phone: c.phone,
    company: c.company?.companyName ?? null,
    location: c.location,
    status: STATUS_LABEL[c.leadStage],
    subStatus: SUB_STATUS_LABEL[c.leadSubStatus],
    temperature: TEMPERATURE_LABEL[c.leadStatus],
    source: SOURCE_LABEL[c.leadSource],
    sourceName: c.sourceName,
    leadScore: c.leadScore,
    leadAge: leadAgeDays(c.createdAt, now),
    reEnquiryCount: c.reEnquiryCount,
    agentId: c.owner.id,
    agentName: c.owner.name,
    nextFollowUpAt: nextFollowUpAt ? nextFollowUpAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function shapeHistory(h: any): LeadHistoryEntry {
  return {
    id: h.id,
    type: HISTORY_TYPE_LABEL[h.type],
    fromValue: h.fromValue,
    toValue: h.toValue,
    remark: h.remark,
    userName: h.user?.name ?? "—",
    createdAt: h.createdAt.toISOString(),
  };
}

// ─── Internals ────────────────────────────────────────────────────────────────

/** Builds the label→enum direction from the enum→label map, so the two can
 *  never fall out of sync by being maintained as separate literals. */
function invert(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}
