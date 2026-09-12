// src/app/api/insights/trends/route.ts
// GET /api/insights/trends?metric=leads|followUps|deals
//                        &granularity=daily|weekly|monthly
//                        &from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Backs the "Trends" graph under the KPI cards. The metric is independent of
// which tab the user is on — you can sit on Lead Insights and still plot
// follow-ups or deals, which is what the metric dropdown is for.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwnerScope, ownerWhere, parseDateParam, toISODate } from "@/lib/scope";
import { defaultRange, bucketByDate, countBuckets, MAX_BUCKETS } from "@/lib/insights";
import { TrendGranularity, TrendMetric, TrendsResponse } from "@/types/insights";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

const METRICS: TrendMetric[] = ["leads", "followUps", "deals"];
const GRANULARITIES: TrendGranularity[] = ["daily", "weekly", "monthly"];

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // ── Validate params BEFORE touching the DB — cheap checks, fail fast ───
    const metric = (searchParams.get("metric") ?? "leads") as TrendMetric;
    if (!METRICS.includes(metric)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid metric. Use: leads, followUps, or deals" },
        { status: 400 }
      );
    }

    const granularity = (searchParams.get("granularity") ?? "daily") as TrendGranularity;
    if (!GRANULARITIES.includes(granularity)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid granularity. Use: daily, weekly, or monthly" },
        { status: 400 }
      );
    }

    // A partial range keeps the default for whichever end wasn't supplied,
    // so `?from=2026-01-01` means "from then until now" rather than erroring.
    const fallback = defaultRange(granularity);
    const from = parseDateParam(searchParams.get("from"), "start") ?? fallback.from;
    const to = parseDateParam(searchParams.get("to"), "end") ?? fallback.to;

    if (from.getTime() > to.getTime()) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "`from` must be on or before `to`" },
        { status: 400 }
      );
    }

    // Guard against a hand-typed range asking for tens of thousands of points
    // — checked on the range itself, so the expensive query never runs.
    if (countBuckets(from, to, granularity) > MAX_BUCKETS) {
      return NextResponse.json<ApiError>(
        {
          error: "Bad Request",
          message: `That range is too wide for ${granularity} points. Pick a shorter range or a coarser granularity.`,
        },
        { status: 400 }
      );
    }

    // Same scope rule as the summary route — a rep's trend line must only
    // ever contain their own rows.
    const ownerIds = await resolveOwnerScope(userId, userRole);
    const scope = ownerWhere(ownerIds);
    const range = { gte: from, lte: to };

    // Each metric buckets on the date that actually represents the event:
    // when a lead arrived, when a follow-up was scheduled, when a deal was
    // opened.
    let dates: Date[];

    if (metric === "leads") {
      const rows = await prisma.contact.findMany({
        where: { ...scope, createdAt: range },
        select: { createdAt: true },
      });
      dates = rows.map((r) => r.createdAt);
    } else if (metric === "followUps") {
      const rows = await prisma.followUp.findMany({
        where: { ...scope, scheduledAt: range },
        select: { scheduledAt: true },
      });
      dates = rows.map((r) => r.scheduledAt);
    } else {
      const rows = await prisma.deal.findMany({
        where: { ...scope, createdAt: range },
        select: { createdAt: true },
      });
      dates = rows.map((r) => r.createdAt);
    }

    // Bucketing in JS rather than SQL date_trunc — same tradeoff the
    // Analytics and Dashboard routes already make, and it keeps week-start
    // and timezone handling in one place (lib/insights) instead of split
    // between Postgres and Node.
    const points = bucketByDate(dates, from, to, granularity);

    const response: TrendsResponse = {
      success: true,
      metric,
      granularity,
      from: toISODate(from),
      to: toISODate(to),
      points,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/insights/trends]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
