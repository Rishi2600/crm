// src/app/api/deals/pipeline/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DealsPipelineResponse, DealCardResponse, DealStageSummary } from "@/types/deals";
import { ApiError } from "@/types/dashboard";

// Human labels ↔ Prisma enum members. The story's payloads/examples use the
// human label ("Proposal"), our schema stores the enum member ("PROPOSAL").
const STAGE_LABEL: Record<string, string> = {
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
};

// Fixed display order for summary cards — independent of however Prisma
// returns groupBy rows, and guarantees all 4 stages appear even at count 0.
const STAGE_ORDER = ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON"] as const;

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

    // ── Parse query params ──────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "createdAt";

    if (!["amount", "expectedCloseDate", "createdAt"].includes(sort)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid sort field. Use: amount, expectedCloseDate, or createdAt" },
        { status: 400 }
      );
    }

    // ── Authorization scope ──────────────────────────────────────────────────
    // 🚩 Same ownership rule as Contacts, flagged here since it's being reused
    // rather than independently decided for Deals — worth revisiting per-module
    // if Deals ever needs different sharing rules (e.g. team-visible deals).
    const ownerFilter =
      userRole === "ADMIN" || userRole === "MANAGER" ? {} : { ownerId: userId };

    // ── Search filter — case-insensitive, partial match across 3 fields ────
    // `contact` is a required to-one relation on Deal (direct nesting works),
    // but `contact.company` is optional (needs `is:` — same gotcha we hit
    // building Contacts search).
    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { contact: { firstName: { contains: search, mode: "insensitive" as const } } },
            { contact: { lastName: { contains: search, mode: "insensitive" as const } } },
            { contact: { company: { is: { companyName: { contains: search, mode: "insensitive" as const } } } } },
          ],
        }
      : {};

    // Pipeline is a "board" view — exclude LOST deals so a card that was
    // marked lost doesn't keep visually sitting in whatever stage it was
    // last in (e.g. a lost deal frozen in "Negotiation"). Only OPEN + WON
    // deals are shown; WON deals surface under the "Closed Won" stage.
    const where = { ...ownerFilter, ...searchFilter, status: { not: "LOST" as const } };

    // ── Summary cards — count + total $ per stage, respecting the same
    // owner/search scope as the pipeline itself ─────────────────────────────
    const summaryRows = await prisma.deal.groupBy({
      by: ["stage"],
      where,
      _count: { id: true },
      _sum: { amount: true },
    });

    const summaryMap = new Map(summaryRows.map((r) => [r.stage, r]));
    const summary: DealStageSummary[] = STAGE_ORDER.map((stageKey) => {
      const row = summaryMap.get(stageKey);
      return {
        stage: STAGE_LABEL[stageKey],
        count: row?._count.id ?? 0,
        totalAmount: Number(row?._sum.amount ?? 0),
      };
    });

    // ── Pipeline — flat deal list. `amount`, `expectedCloseDate`, and
    // `createdAt` are all real stored columns (unlike Contacts' computed
    // dealValue), so ORDER BY works natively — no in-memory sort workaround
    // needed here, and pagination (deferred per story) would be equally easy
    // to bolt on later since nothing here requires fetch-everything-first. ──
    const orderBy =
      sort === "amount" ? { amount: "desc" as const }
      : sort === "expectedCloseDate" ? { expectedCloseDate: "asc" as const }
      : { createdAt: "desc" as const };

    const deals = await prisma.deal.findMany({
      where,
      orderBy,
      select: {
        id: true,
        title: true,
        amount: true,
        stage: true,
        probability: true,
        expectedCloseDate: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    const pipeline: DealCardResponse[] = deals.map((d) => ({
      id: d.id,
      title: d.title,
      amount: Number(d.amount),
      contactName: `${d.contact.firstName} ${d.contact.lastName}`,
      expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString().split("T")[0] : null,
      probability: d.probability,
      stage: STAGE_LABEL[d.stage] ?? d.stage,
    }));

    const response: DealsPipelineResponse = {
      success: true,
      message: pipeline.length === 0 ? "No deals found" : "Pipeline fetched successfully",
      summary,
      pipeline,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/deals/pipeline]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch pipeline" },
      { status: 500 }
    );
  }
}