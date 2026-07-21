// src/types/deals.ts

// ─── Single Deal Card (as returned to frontend) ──────────────────────────────

export interface DealCardResponse {
  id: string;
  title: string;
  amount: number;
  contactName: string;
  expectedCloseDate: string | null; // ISO date, e.g. "2026-07-01"
  probability: number;              // 0–100
  stage: string;                    // "Qualification" | "Proposal" | "Negotiation" | "Closed Won"
}

// ─── Per-Stage Summary Card ───────────────────────────────────────────────────

export interface DealStageSummary {
  stage: string;
  count: number;
  totalAmount: number;
}

// ─── Pipeline API Response ────────────────────────────────────────────────────

export interface DealsPipelineResponse {
  success: boolean;
  message: string;
  summary: DealStageSummary[];
  pipeline: DealCardResponse[];
}

// ─── Stage Update Payload ─────────────────────────────────────────────────────

export interface StageUpdatePayload {
  stage: string; // human label, e.g. "Negotiation" — validated against ALLOWED_STAGES
}

export interface StageUpdateResponse {
  success: boolean;
  message: string;
  deal: DealCardResponse;
}

// ─── Create Deal Payload ───────────────────────────────────────────────────────

export interface CreateDealPayload {
  title: string;
  contactId: string;
  amount: number;
  stage?: string;              // defaults to "Qualification"
  probability?: number;        // 0–100, defaults to 0
  expectedCloseDate?: string;  // ISO date
  ownerId?: string;             // defaults to creator — only ADMIN/MANAGER may override, within hierarchy
}

export interface CreateDealResponse {
  success: boolean;
  message: string;
  data: DealCardResponse;
}