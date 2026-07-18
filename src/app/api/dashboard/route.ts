// // src/app/api/dashboard/route.ts
// // GET /api/dashboard — single API call, returns all dashboard data

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { DashboardResponse, GraphPoint, PipelineStage, ApiError } from "@/types/dashboard";

// const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// export async function GET(request: NextRequest) {
//   try {
//     const now = new Date();
//     const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//     const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//     const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

//     // ── Run all queries in parallel - Batch1 ────────────────────────────────────────
//     const [
//       wonDeals,
//       currentMonthRevenue,
//       previousMonthRevenue,
//       activeDealsCount,
//       totalContacts,
//       totalDeals,
//       wonDealsCount,
//     ] = await Promise.all([
//       prisma.deal.aggregate({ 
//         where: { status: "WON" },
//         _sum: { amount: true }
//       }),
//       prisma.deal.aggregate({
//         where: { status: "WON", createdAt: { gte: currentMonthStart } },
//         _sum: { amount: true }
//       }),
//       prisma.deal.aggregate({
//         where: { status: "WON", createdAt: { gte: previousMonthStart, lt: currentMonthStart } },
//         _sum: { amount: true }
//       }),
//       prisma.deal.count({
//         where: { status: "OPEN" }
//       }),
//       prisma.contact.count(),
//       prisma.deal.count(),
//       prisma.deal.count({
//         where: { status: "WON" }
//       }),
//     ]);

//     // ── Run all queries in parallel - Batch2 ────────────────────────────────────────
//     const [
//       revenueByMonth,
//       dealsByMonth,
//       pipelineByStage,
//       recentActivities
//     ] = await Promise.all([
//       prisma.deal.findMany({
//         where: { status: "WON", createdAt: { gte: sixMonthsAgo } },
//         select: { amount: true, createdAt: true },
//         orderBy: { createdAt: "asc" },
//       }),
//       prisma.deal.findMany({
//         where: { createdAt: { gte: sixMonthsAgo } },
//         select: { createdAt: true },
//         orderBy: { createdAt: "asc" },
//       }),
//       prisma.deal.groupBy({
//         by: ["stage"],
//         where: { status: "OPEN" },
//         _count: { id: true },
//         _sum: { amount: true },
//       }),
//       prisma.activity.findMany({
//         take: 10,
//         orderBy: { createdAt: "desc" },
//         include: { user: { select: { name: true, email: true } } },
//       }),
//     ]);

//     // ── Calculate Revenue & Growth ─────────────────────────────────────────
//     const totalRevenue = Number(wonDeals._sum.amount ?? 0);
//     const currentRev = Number(currentMonthRevenue._sum.amount ?? 0);
//     const previousRev = Number(previousMonthRevenue._sum.amount ?? 0);

//     const growth =
//       previousRev === 0
//         ? 100
//         : Math.round(((currentRev - previousRev) / previousRev) * 100 * 10) / 10;

//     // ── Calculate Conversion Rate ──────────────────────────────────────────
//     const conversionRate =
//       totalDeals === 0
//         ? 0
//         : Math.round((wonDealsCount / totalDeals) * 100 * 10) / 10;

//     // ── Build Revenue Graph (last 6 months) ───────────────────────────────
//     const revenueMap = new Map<string, number>();
//     for (let i = 5; i >= 0; i--) {
//       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
//       revenueMap.set(MONTH_NAMES[d.getMonth()], 0);
//     }
//     revenueByMonth.forEach((deal) => {
//       const key = MONTH_NAMES[deal.createdAt.getMonth()];
//       if (revenueMap.has(key)) {
//         revenueMap.set(key, (revenueMap.get(key) ?? 0) + Number(deal.amount));
//       }
//     });
//     const revenueGraph: GraphPoint[] = Array.from(revenueMap.entries()).map(
//       ([month, value]) => ({ month, value })
//     );

//     // ── Build Deals Graph (last 6 months) ─────────────────────────────────
//     const dealsMap = new Map<string, number>();
//     for (let i = 5; i >= 0; i--) {
//       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
//       dealsMap.set(MONTH_NAMES[d.getMonth()], 0);
//     }
//     dealsByMonth.forEach((deal) => {
//       const key = MONTH_NAMES[deal.createdAt.getMonth()];
//       if (dealsMap.has(key)) {
//         dealsMap.set(key, (dealsMap.get(key) ?? 0) + 1);
//       }
//     });
//     const dealsGraph: GraphPoint[] = Array.from(dealsMap.entries()).map(
//       ([month, value]) => ({ month, value })
//     );

//     // ── Format Pipeline ────────────────────────────────────────────────────
//     const STAGE_LABELS: Record<string, string> = {
//       QUALIFICATION: "Qualification",
//       PROPOSAL: "Proposal",
//       NEGOTIATION: "Negotiation",
//       CLOSED_WON: "Closed Won",
//     };

//     const pipeline: PipelineStage[] = pipelineByStage.map((p) => ({
//       stage: STAGE_LABELS[p.stage] ?? p.stage,
//       count: p._count.id,
//       amount: Number(p._sum.amount ?? 0),
//     }));

//     // ── Format Activities ──────────────────────────────────────────────────
//     const activities = recentActivities.map((a) => ({
//       id: a.id,
//       activityType: a.activityType,
//       entityType: a.entityType,
//       message: a.message,
//       createdAt: a.createdAt.toISOString(),
//       user: { name: a.user.name, email: a.user.email },
//     }));

//     // ── Final Response ─────────────────────────────────────────────────────
//     const data: DashboardResponse = {
//       revenue: { amount: totalRevenue, growth },
//       activeDeals: activeDealsCount,
//       contacts: totalContacts,
//       conversionRate,
//       revenueGraph,
//       dealsGraph,
//       pipeline,
//       activities,
//     };

//     return NextResponse.json(data, {
//       status: 200,
//       headers: {
//         "Cache-Control": "private, max-age=60", // cache 60s per user
//       },
//     });
//   } catch (error) {
//     console.error("[GET /api/dashboard]", error);
//     return NextResponse.json<ApiError>(
//       { error: "Internal Server Error", message: "Failed to fetch dashboard data" },
//       { status: 500 }
//     );
//   }
// }



// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DashboardResponse, GraphPoint, PipelineStage, ApiError } from "@/types/dashboard";

// Forces this route to run fresh on every request — no static generation,
// no edge/CDN caching. Explicit rather than relying on Next.js's implicit
// "reading headers/cookies opts out of caching" detection, since that
// detection has sharp edges on Vercel that caused this exact route to
// serve stale data in production after a self-set Cache-Control header
// was picked up more aggressively than intended.
export const dynamic = "force-dynamic";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── Run queries in small batches instead of all at once ───────────────
    // Batch 1: scalar aggregates (fast, no rows returned)
    const [
      wonDealsTotal,
      currentMonthRevenue,
      previousMonthRevenue,
      activeDealsCount,
      totalContacts,
      totalDeals,
      wonDealsCount,
    ] = await Promise.all([
      prisma.deal.aggregate({ where: { status: "WON" }, _sum: { amount: true } }),
      prisma.deal.aggregate({ where: { status: "WON", createdAt: { gte: currentMonthStart } }, _sum: { amount: true } }),
      prisma.deal.aggregate({ where: { status: "WON", createdAt: { gte: previousMonthStart, lt: currentMonthStart } }, _sum: { amount: true } }),
      prisma.deal.count({ where: { status: "OPEN" } }),
      prisma.contact.count(),
      prisma.deal.count(),
      prisma.deal.count({ where: { status: "WON" } }),
    ]);

    // Batch 2: row-returning queries
    const [revenueByMonth, dealsByMonth, pipelineByStage, recentActivities] = await Promise.all([
      prisma.deal.findMany({
        where: { status: "WON", createdAt: { gte: sixMonthsAgo } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.deal.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.deal.groupBy({
        by: ["stage"],
        where: { status: "OPEN" },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.activity.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    // ── Calculations ──────────────────────────────────────────────────────
    const totalRevenue = Number(wonDealsTotal._sum.amount ?? 0);
    const currentRev   = Number(currentMonthRevenue._sum.amount ?? 0);
    const previousRev  = Number(previousMonthRevenue._sum.amount ?? 0);
    const growth       = previousRev === 0 ? 100 : Math.round(((currentRev - previousRev) / previousRev) * 1000) / 10;
    const conversionRate = totalDeals === 0 ? 0 : Math.round((wonDealsCount / totalDeals) * 1000) / 10;

    // ── Revenue graph ─────────────────────────────────────────────────────
    const revenueMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      revenueMap.set(MONTH_NAMES[d.getMonth()], 0);
    }
    revenueByMonth.forEach((deal) => {
      const key = MONTH_NAMES[deal.createdAt.getMonth()];
      if (revenueMap.has(key)) revenueMap.set(key, (revenueMap.get(key) ?? 0) + Number(deal.amount));
    });
    const revenueGraph: GraphPoint[] = Array.from(revenueMap.entries()).map(([month, value]) => ({ month, value }));

    // ── Deals graph ───────────────────────────────────────────────────────
    const dealsMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      dealsMap.set(MONTH_NAMES[d.getMonth()], 0);
    }
    dealsByMonth.forEach((deal) => {
      const key = MONTH_NAMES[deal.createdAt.getMonth()];
      if (dealsMap.has(key)) dealsMap.set(key, (dealsMap.get(key) ?? 0) + 1);
    });
    const dealsGraph: GraphPoint[] = Array.from(dealsMap.entries()).map(([month, value]) => ({ month, value }));

    // ── Pipeline ──────────────────────────────────────────────────────────
    const STAGE_LABELS: Record<string, string> = {
      QUALIFICATION: "Qualification",
      PROPOSAL:      "Proposal",
      NEGOTIATION:   "Negotiation",
      CLOSED_WON:    "Closed Won",
    };
    const pipeline: PipelineStage[] = pipelineByStage.map((p) => ({
      stage:  STAGE_LABELS[p.stage] ?? p.stage,
      count:  p._count.id,
      amount: Number(p._sum.amount ?? 0),
    }));

    // ── Activities ────────────────────────────────────────────────────────
    const activities = recentActivities.map((a) => ({
      id:           a.id,
      activityType: a.activityType,
      entityType:   a.entityType,
      message:      a.message,
      createdAt:    a.createdAt.toISOString(),
      user:         { name: a.user.name, email: a.user.email },
    }));

    const data: DashboardResponse = {
      revenue: { amount: totalRevenue, growth },
      activeDeals: activeDealsCount,
      contacts: totalContacts,
      conversionRate,
      revenueGraph,
      dealsGraph,
      pipeline,
      activities,
    };

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}