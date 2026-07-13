// src/app/api/analytics/dashboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AnalyticsDashboardResponse,
  AnalyticsKPIs,
  MonthlyRevenuePoint,
  GrowthPoint,
  FunnelStage,
  TopPerformer,
} from "@/types/analytics";
import { ApiError } from "@/types/dashboard";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STAGE_LABEL: Record<string, string> = {
  QUALIFICATION: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed",
};
const STAGE_ORDER = ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON"] as const;

export async function GET(request: NextRequest) {
  try {
    // ── Auth context ─────────────────────────────────────────────────────────
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    // ── Role-based scope — 🚩 reused hierarchy pattern (4th time now: Contacts
    // → Deals → Tasks → Analytics), adapted for a DATA-EXPOSURE risk this
    // time rather than a write-side IDOR: without this, a Sales Exec could
    // see company-wide revenue or a teammate's numbers just by hitting this
    // endpoint. ADMIN sees everything, MANAGER sees self + direct reports
    // (same one-level depth decided in the Tasks module), SALES_REP sees
    // only their own numbers. ──────────────────────────────────────────────
    let ownerIds: string[] | undefined;
    if (userRole === "ADMIN") {
      ownerIds = undefined; // no filter — everyone
    } else if (userRole === "MANAGER") {
      const reports = await prisma.user.findMany({ where: { managerId: userId }, select: { id: true } });
      ownerIds = [userId, ...reports.map((r) => r.id)];
    } else {
      ownerIds = [userId];
    }
    const ownerFilter = ownerIds ? { ownerId: { in: ownerIds } } : {};
    const contactOwnerFilter = ownerIds ? { ownerId: { in: ownerIds } } : {};

    // ── Optional date-range filter ──────────────────────────────────────────
    // Applied to createdAt for "volume" metrics (growth, active leads, win
    // rate's denominator) and to closedAt for "closed deal" metrics (revenue
    // trend, average deal size, sales cycle, top performers) — NOT the same
    // field for both, because LOST deals never get a closedAt set (no
    // endpoint in the app marks a deal Lost yet — a standing gap flagged
    // separately). Filtering win-rate's LOST count by closedAt would
    // silently and permanently exclude every Lost deal, skewing the rate.
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    const createdRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
    const closedRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    const topPerformerSort = searchParams.get("sort") === "deals" ? "deals" : "revenue";

    // ── Batch 1 — scalar aggregates (fast, no rows) ─────────────────────────
    const [
      wonAgg,
      wonCount,
      lostCount,
      activeLeadsCount,
      leadsCount,
    ] = await Promise.all([
      prisma.deal.aggregate({
        where: { status: "WON", ...ownerFilter, ...(closedRange ? { closedAt: closedRange } : {}) },
        _sum: { amount: true },
      }),
      prisma.deal.count({
        where: { status: "WON", ...ownerFilter, ...(createdRange ? { createdAt: createdRange } : {}) },
      }),
      prisma.deal.count({
        where: { status: "LOST", ...ownerFilter, ...(createdRange ? { createdAt: createdRange } : {}) },
      }),
      prisma.deal.count({
        where: { status: "OPEN", ...ownerFilter, ...(createdRange ? { createdAt: createdRange } : {}) },
      }),
      prisma.contact.count({
        where: { ...contactOwnerFilter, ...(createdRange ? { createdAt: createdRange } : {}) },
      }),
    ]);

    // ── Batch 2 — row-returning queries ──────────────────────────────────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const [
      salesCycleRows,
      revenueTrendRows,
      dealsGrowthRows,
      contactsGrowthRows,
      funnelByStage,
      topPerformerRows,
    ] = await Promise.all([
      // Sales Cycle — small dataset, computed in JS (same tradeoff pattern
      // as Contacts' dealValue sort) rather than a raw SQL AVG(date diff).
      prisma.deal.findMany({
        where: {
          status: "WON",
          closedAt: { not: null },
          ...ownerFilter,
          ...(closedRange ? { closedAt: closedRange } : {}),
        },
        select: { createdAt: true, closedAt: true },
      }),

      prisma.deal.findMany({
        where: {
          status: "WON",
          ...ownerFilter,
          closedAt: closedRange ?? { gte: sixMonthsAgo },
        },
        select: { amount: true, closedAt: true },
      }),

      prisma.deal.findMany({
        where: { ...ownerFilter, createdAt: createdRange ?? { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),

      prisma.contact.findMany({
        where: { ...contactOwnerFilter, createdAt: createdRange ?? { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),

      prisma.deal.groupBy({
        by: ["stage"],
        where: { status: { not: "LOST" }, ...ownerFilter, ...(createdRange ? { createdAt: createdRange } : {}) },
        _count: { id: true },
      }),

      prisma.deal.groupBy({
        by: ["ownerId"],
        where: { status: "WON", ...ownerFilter, ...(closedRange ? { closedAt: closedRange } : {}) },
        _count: { id: true },
        _sum: { amount: true },
      }),
    ]);

    // ── KPI calculations ──────────────────────────────────────────────────────
    const totalWonRevenue = Number(wonAgg._sum.amount ?? 0);
    const averageDealSize = wonCount === 0 ? 0 : Math.round(totalWonRevenue / wonCount);

    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed === 0 ? 0 : Math.round((wonCount / totalClosed) * 1000) / 10;

    const salesCycle =
      salesCycleRows.length === 0
        ? 0
        : Math.round(
            salesCycleRows.reduce((sum, d) => {
              const days = (d.closedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / salesCycleRows.length
          );

    const kpis: AnalyticsKPIs = {
      averageDealSize,
      winRate,
      salesCycle,
      activeLeads: activeLeadsCount,
    };

    // ── Revenue Trend — bucketed by CLOSED month, last 6 months by default ──
    const revenueMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      revenueMap.set(MONTH_NAMES[d.getMonth()], 0);
    }
    revenueTrendRows.forEach((d) => {
      if (!d.closedAt) return;
      const key = MONTH_NAMES[d.closedAt.getMonth()];
      if (revenueMap.has(key)) revenueMap.set(key, (revenueMap.get(key) ?? 0) + Number(d.amount));
    });
    const revenueTrend: MonthlyRevenuePoint[] = Array.from(revenueMap.entries()).map(([month, amount]) => ({ month, amount }));

    // ── Growth — deals + contacts created per month, merged ────────────────
    const growthMap = new Map<string, { deals: number; contacts: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      growthMap.set(MONTH_NAMES[d.getMonth()], { deals: 0, contacts: 0 });
    }
    dealsGrowthRows.forEach((d) => {
      const key = MONTH_NAMES[d.createdAt.getMonth()];
      const entry = growthMap.get(key);
      if (entry) entry.deals += 1;
    });
    contactsGrowthRows.forEach((c) => {
      const key = MONTH_NAMES[c.createdAt.getMonth()];
      const entry = growthMap.get(key);
      if (entry) entry.contacts += 1;
    });
    const growth: GrowthPoint[] = Array.from(growthMap.entries()).map(([month, v]) => ({ month, ...v }));

    // ── Sales Funnel — Leads (Contacts) + 4 Deal stages ─────────────────────
    // 🚩 "Leads" isn't a Deal.stage value — interpreting it as total Contact
    // count (top-of-funnel volume before a deal even exists). Flagged as an
    // assumption in the chunk's audit, not something the schema states.
    const stageCountMap = new Map(funnelByStage.map((r) => [r.stage, r._count.id]));
    const salesFunnel: FunnelStage[] = [
      { stage: "Leads", count: leadsCount },
      ...STAGE_ORDER.map((s) => ({ stage: STAGE_LABEL[s], count: stageCountMap.get(s) ?? 0 })),
    ];

    // ── Top Performers ──────────────────────────────────────────────────────
    const performerUserIds = topPerformerRows.map((r) => r.ownerId);
    const performerUsers = performerUserIds.length
      ? await prisma.user.findMany({ where: { id: { in: performerUserIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = new Map(performerUsers.map((u) => [u.id, u.name]));

    let topPerformers: TopPerformer[] = topPerformerRows.map((r) => ({
      name: nameMap.get(r.ownerId) ?? "Unknown",
      closedDeals: r._count.id,
      revenue: Number(r._sum.amount ?? 0),
    }));

    topPerformers.sort((a, b) =>
      topPerformerSort === "deals" ? b.closedDeals - a.closedDeals : b.revenue - a.revenue
    );
    topPerformers = topPerformers.slice(0, 10);

    // ── Final response ───────────────────────────────────────────────────────
    const response: AnalyticsDashboardResponse = {
      kpis,
      revenueTrend,
      growth,
      salesFunnel,
      topPerformers,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/analytics/dashboard]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}