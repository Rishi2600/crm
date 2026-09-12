// src/app/api/insights/summary/route.ts
// GET /api/insights/summary?tab=lead|followup&from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Backs the KPI card grid on the Dashboard's Lead Insights and Follow-Up
// Insights tabs. Split from /api/insights/trends so changing the graph's
// metric doesn't refetch the cards (and vice versa) — the two controls are
// independent in the UI.
//
// The Deal Insights tab is NOT served here: it keeps the pre-existing
// /api/dashboard route unchanged.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveOwnerScope,
  ownerWhere,
  parseDateParam,
  startOfDay,
  endOfDay,
} from "@/lib/scope";
import {
  InsightsSummaryResponse,
  LeadInsightKpis,
  FollowUpInsightKpis,
} from "@/types/insights";
import { ApiError } from "@/types/dashboard";

// Same reasoning as /api/dashboard — these numbers change on every write and
// must never be served stale from an edge cache.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // ── Auth context — set by middleware after JWT verification ────────────
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") ?? "lead";

    if (tab !== "lead" && tab !== "followup") {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid tab. Use: lead or followup" },
        { status: 400 }
      );
    }

    const from = parseDateParam(searchParams.get("from"), "start");
    const to = parseDateParam(searchParams.get("to"), "end");

    if (from && to && from.getTime() > to.getTime()) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "`from` must be on or before `to`" },
        { status: 400 }
      );
    }

    const range =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    // 🚩 Data-exposure scope — without this a Sales Rep could read the whole
    // company's lead counts just by hitting this endpoint. Same rule as
    // Analytics: ADMIN all, MANAGER self + direct reports, otherwise self.
    const ownerIds = await resolveOwnerScope(userId, userRole);
    const scope = ownerWhere(ownerIds);

    if (tab === "lead") {
      const kpis = await leadKpis(scope, range);
      return NextResponse.json<InsightsSummaryResponse>(
        { success: true, tab: "lead", kpis },
        { status: 200 }
      );
    }

    const kpis = await followUpKpis(scope, range);
    return NextResponse.json<InsightsSummaryResponse>(
      { success: true, tab: "followup", kpis },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/insights/summary]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch insights summary" },
      { status: 500 }
    );
  }
}

// ─── Lead Insights ────────────────────────────────────────────────────────────

async function leadKpis(scope: object, range: object | undefined): Promise<LeadInsightKpis> {
  // Volume cards are windowed on createdAt — "how many leads came in during
  // this period".
  const base = { ...scope, ...(range ? { createdAt: range } : {}) };

  const [byStage, total, referred, revived, reEnquired] = await Promise.all([
    // One groupBy instead of five separate counts — the five stage cards are
    // mutually exclusive, so a single pass over the same rows answers all of
    // them.
    prisma.contact.groupBy({ by: ["leadStage"], where: base, _count: { id: true } }),

    prisma.contact.count({ where: base }),

    prisma.contact.count({ where: { ...base, leadSource: "REFERRAL" } }),

    // 🚩 Revived is windowed on revivedAt, NOT createdAt — a lead created two
    // years ago and revived this week belongs in THIS week's Revived count,
    // which is the whole point of the card. Same deliberate field-split as
    // Analytics' createdAt-vs-closedAt handling.
    prisma.contact.count({
      where: { ...scope, revivedAt: range ? range : { not: null } },
    }),

    prisma.contact.count({ where: { ...base, reEnquiryCount: { gt: 0 } } }),
  ]);

  const stageCount = new Map(byStage.map((r) => [r.leadStage, r._count.id]));

  return {
    totalLeads: total,
    freshLeads: stageCount.get("FRESH") ?? 0,
    closedLeads: stageCount.get("CLOSED") ?? 0,
    referredLeads: referred,
    revivedLeads: revived,
    reEnquiredLeads: reEnquired,
    convertedLeads: stageCount.get("CONVERTED") ?? 0,
    irrelevantLeads: stageCount.get("IRRELEVANT") ?? 0,
    interestedLeads: stageCount.get("INTERESTED") ?? 0,
  };
}

// ─── Follow-Up Insights ───────────────────────────────────────────────────────

async function followUpKpis(scope: object, range: object | undefined): Promise<FollowUpInsightKpis> {
  // The window selects follow-ups by WHEN THEY WERE SCHEDULED, so "last 30
  // days" means the 30 days' worth of touchpoints on the calendar rather than
  // whenever the row happened to be created.
  const base = { ...scope, ...(range ? { scheduledAt: range } : {}) };

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [byStatus, total, overdue, dueToday, rescheduled, converted] = await Promise.all([
    prisma.followUp.groupBy({ by: ["status"], where: base, _count: { id: true } }),

    prisma.followUp.count({ where: base }),

    // Overdue is DERIVED, not a stored status — still pending with its time
    // already past. Computing it at query time means it can never go stale
    // the way a nightly "mark overdue" job would.
    prisma.followUp.count({
      where: { ...base, status: "PENDING", scheduledAt: { lt: now } },
    }),

    // 🚩 Due Today deliberately IGNORES the selected range. It answers "what
    // do I have to do right now", which stays true whether the user is
    // looking at last quarter or this week — scoping it to the range would
    // make it read 0 on every historical window, which reads as broken.
    prisma.followUp.count({
      where: { ...scope, scheduledAt: { gte: todayStart, lte: todayEnd } },
    }),

    prisma.followUp.count({ where: { ...base, rescheduleCount: { gt: 0 } } }),

    prisma.followUp.count({ where: { ...base, outcome: "CONVERTED" } }),
  ]);

  const statusCount = new Map(byStatus.map((r) => [r.status, r._count.id]));

  return {
    totalFollowUps: total,
    pending: statusCount.get("PENDING") ?? 0,
    completed: statusCount.get("COMPLETED") ?? 0,
    overdue,
    dueToday,
    rescheduled,
    missed: statusCount.get("MISSED") ?? 0,
    // Cancelled is counted separately rather than folded into Missed — a
    // called-off follow-up and one nobody actioned mean different things, and
    // without its own card these rows would sit in Total with no card
    // accounting for them.
    cancelled: statusCount.get("CANCELLED") ?? 0,
    converted,
  };
}
