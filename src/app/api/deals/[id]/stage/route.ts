// src/app/api/deals/[id]/stage/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StageUpdatePayload, StageUpdateResponse, DealCardResponse } from "@/types/deals";
import { ApiError } from "@/types/dashboard";

const STAGE_LABEL: Record<string, string> = {
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
};

// Reverse lookup — human label (as sent by the frontend) → Prisma enum member
const LABEL_TO_STAGE: Record<string, string> = {
  Qualification: "QUALIFICATION",
  Proposal: "PROPOSAL",
  Negotiation: "NEGOTIATION",
  "Closed Won": "CLOSED_WON",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const dealId = params.id;
    const body: StageUpdatePayload = await request.json();
    const requestedStage = body?.stage;

    // ── Validate stage BEFORE touching the DB — cheap check, fail fast ─────
    const stageEnum = requestedStage ? LABEL_TO_STAGE[requestedStage] : undefined;
    if (!stageEnum) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid Stage" },
        { status: 400 }
      );
    }

    // ── Confirm the deal exists ──────────────────────────────────────────────
    const existingDeal = await prisma.deal.findUnique({ where: { id: dealId } });

    if (!existingDeal) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Deal Not Found" },
        { status: 404 }
      );
    }

    // 🚩 Ownership check — same rule reused from Contacts (ADMIN/MANAGER
    // bypass, SALES_REP restricted to deals they own). This is the fix for
    // the IDOR risk flagged during the audit: without this, any authenticated
    // user could PATCH any deal ID and move stages on deals they don't own,
    // just by guessing/incrementing IDs. Flagged here since the rule is
    // borrowed rather than independently designed for Deals — revisit if
    // Deals ever needs different sharing semantics (e.g. team-visible deals).
    const isOwner = existingDeal.ownerId === userId;
    const isElevated = userRole === "ADMIN" || userRole === "MANAGER";

    if (!isOwner && !isElevated) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to update this deal" },
        { status: 403 }
      );
    }

    // 🚩 Analytics gap fix: moving a deal to "Closed Won" here is currently
    // the ONLY code path that ever marks a deal as actually won — previously
    // this endpoint only touched `stage`, leaving `status` and `closedAt`
    // stuck at their defaults forever outside of seed data. Analytics'
    // Sales Cycle KPI and Revenue Trend graph both need a real closedAt, so
    // this is now set here automatically. (Marking a deal LOST still has no
    // endpoint anywhere in the app — a separate, still-open gap.)
    const isClosingWon = stageEnum === "CLOSED_WON";

    // ── Update — updatedAt bumps automatically via @updatedAt ──────────────
    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: {
        stage: stageEnum as any,
        ...(isClosingWon ? { status: "WON" as any, closedAt: new Date() } : {}),
      },
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

    const deal: DealCardResponse = {
      id: updated.id,
      title: updated.title,
      amount: Number(updated.amount),
      contactName: `${updated.contact.firstName} ${updated.contact.lastName}`,
      expectedCloseDate: updated.expectedCloseDate
        ? updated.expectedCloseDate.toISOString().split("T")[0]
        : null,
      probability: updated.probability,
      stage: STAGE_LABEL[updated.stage] ?? updated.stage,
    };

    const response: StageUpdateResponse = {
      success: true,
      message: "Stage updated successfully",
      deal,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/deals/[id]/stage]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to update deal stage" },
      { status: 500 }
    );
  }
}