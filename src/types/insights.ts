// src/types/insights.ts
// Shared types for the Dashboard's three insight tabs.

// ─── Tabs ─────────────────────────────────────────────────────────────────────
// "deal" is the pre-existing dashboard (revenue / pipeline / activity feed) —
// it keeps its own /api/dashboard route and DashboardResponse type, and is
// listed here only so the tab switcher has one union to work with.
export type InsightsTab = "lead" | "followup" | "deal";

// ─── KPI cards ────────────────────────────────────────────────────────────────

export interface LeadInsightKpis {
  totalLeads: number;
  freshLeads: number;
  closedLeads: number;
  referredLeads: number;
  revivedLeads: number;
  reEnquiredLeads: number;
  convertedLeads: number;
  irrelevantLeads: number;
  interestedLeads: number;
}

export interface FollowUpInsightKpis {
  totalFollowUps: number;
  pending: number;
  completed: number;
  overdue: number;
  dueToday: number;
  rescheduled: number;
  missed: number;
  converted: number;
}

// Discriminated on `tab` so a consumer that has narrowed the tab also has the
// matching KPI shape, without either field being optional-and-hoped-for.
export type InsightsSummaryResponse =
  | { success: true; tab: "lead"; kpis: LeadInsightKpis }
  | { success: true; tab: "followup"; kpis: FollowUpInsightKpis };

// ─── Trend graph ──────────────────────────────────────────────────────────────

export type TrendMetric = "leads" | "followUps" | "deals";
export type TrendGranularity = "daily" | "weekly" | "monthly";

export interface TrendPoint {
  /** Bucket start, "YYYY-MM-DD" — stable key, safe to sort on. */
  date: string;
  /** Human label for the axis, e.g. "05/09/2026", "05 Sep", "Sep 2026". */
  label: string;
  value: number;
}

export interface TrendsResponse {
  success: boolean;
  metric: TrendMetric;
  granularity: TrendGranularity;
  /** Echoed back so the chart can caption the exact window it's showing. */
  from: string;
  to: string;
  points: TrendPoint[];
}

// ─── Date range presets ───────────────────────────────────────────────────────
// Resolved to concrete from/to dates on the client (see DateRangeFilter) and
// sent to the API as plain dates — the API deliberately knows nothing about
// preset names, so adding one is a UI-only change.
export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

export interface DateRange {
  /** "YYYY-MM-DD", inclusive. */
  from: string;
  /** "YYYY-MM-DD", inclusive — the API widens this to end-of-day. */
  to: string;
}
