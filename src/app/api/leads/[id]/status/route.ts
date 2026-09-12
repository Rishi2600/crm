// src/app/api/leads/[id]/status/route.ts
// PATCH — moves a lead's status and/or sub-status.
//
// Its own route rather than a branch of PATCH /api/leads/[id], for the same
// reason the Deals module split /deals/[id]/stage off from /deals/[id]: a
// status move isn't a field edit. It has its own rule (the stage→sub-status
// pairing), its own side effects (the revival timestamp) and its own
// precondition — a remark.
//
// 🚩 The remark is MANDATORY here, and this is the only route that can change
// a lead's status. That's what makes "every status change has a recorded
// reason" a property of the system rather than a habit the UI politely
// encourages: a request without one is a 400, whether it came from the
// prompt dialog or from curl.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  STATUS_LABEL,
  SUB_STATUS_LABEL,
  LABEL_TO_STATUS,
  LABEL_TO_SUB_STATUS,
  SUB_STATUS_BY_STATUS,
  defaultSubStatusFor,
  isValidPair,
} from "@/lib/leads";
import { ChangeLeadStatusPayload, LeadStatusLabel, LeadSubStatusLabel } from "@/types/leads";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

/** Stages that mean the lead is out of play. Coming BACK from one of these is
 *  what the Lead Insights "Revived Leads" card counts, via Contact.revivedAt. */
const DEAD_STATUSES: LeadStatusLabel[] = ["Closed", "Irrelevant"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    const body: ChangeLeadStatusPayload = await request.json();

    const remark = body.remark?.trim();
    if (!remark) {
      return bad("A remark is required when a lead's status changes");
    }
    if (remark.length > 2000) {
      return bad("Remark is too long (2000 characters maximum)");
    }

    if (body.status === undefined && body.subStatus === undefined) {
      return bad("Provide a status, a sub-status, or both");
    }

    if (body.status !== undefined && !LABEL_TO_STATUS[body.status]) {
      return bad(`Invalid status "${body.status}"`);
    }
    if (body.subStatus !== undefined && !LABEL_TO_SUB_STATUS[body.subStatus]) {
      return bad(`Invalid sub-status "${body.subStatus}"`);
    }

    const existing = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, leadStage: true, leadSubStatus: true },
    });

    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Lead Not Found" },
        { status: 404 }
      );
    }

    // 🚩 Ownership — same rule as the deal-stage, task-status and follow-up
    // endpoints. Without it any authenticated user could reclassify someone
    // else's leads by guessing ids.
    const isOwner = existing.ownerId === userId;
    const isElevated = userRole === "ADMIN" || userRole === "MANAGER";
    if (!isOwner && !isElevated) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to update this lead" },
        { status: 403 }
      );
    }

    const currentStatus = STATUS_LABEL[existing.leadStage];
    const currentSubStatus = SUB_STATUS_LABEL[existing.leadSubStatus];

    const nextStatus = (body.status ?? currentStatus) as LeadStatusLabel;

    // When the status moves and the caller named no sub-status, the lead falls
    // to that status's first sub-status. Leaving the old one in place would
    // strand leads on impossible pairs like Converted · Untouched.
    const nextSubStatus = (body.subStatus ??
      (body.status && body.status !== currentStatus
        ? defaultSubStatusFor(nextStatus)
        : currentSubStatus)) as LeadSubStatusLabel;

    if (!isValidPair(nextStatus, nextSubStatus)) {
      return bad(
        `"${nextSubStatus}" is not a sub-status of "${nextStatus}". Valid: ${SUB_STATUS_BY_STATUS[nextStatus].join(", ")}`
      );
    }

    if (nextStatus === currentStatus && nextSubStatus === currentSubStatus) {
      return bad("This lead is already at that status");
    }

    const data: Record<string, unknown> = {
      leadStage: LABEL_TO_STATUS[nextStatus],
      leadSubStatus: LABEL_TO_SUB_STATUS[nextSubStatus],
    };

    // 🚩 Revival — a lead coming back from Closed/Irrelevant into a live stage
    // stamps revivedAt, which is the field the Dashboard's "Revived Leads"
    // card counts. Until this route existed nothing in the app ever set it,
    // so that card could only ever show seeded numbers. Re-stamped on each
    // revival rather than kept as the first one, because the card is windowed
    // by date and asks "revived in this period", not "ever revived".
    const isRevival =
      DEAD_STATUSES.includes(currentStatus) && !DEAD_STATUSES.includes(nextStatus);
    if (isRevival) data.revivedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.contact.update({ where: { id: params.id }, data });

      // The transition and the remark explaining it are ONE row, so the
      // timeline can never show a status change whose reason went missing.
      await tx.leadHistory.create({
        data: {
          contactId: params.id,
          userId,
          type: "STATUS_CHANGED",
          fromValue: `${currentStatus} · ${currentSubStatus}`,
          toValue: `${nextStatus} · ${nextSubStatus}`,
          remark,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: isRevival
          ? `Lead revived and moved to ${nextStatus}`
          : `Lead moved to ${nextStatus} · ${nextSubStatus}`,
        data: { status: nextStatus, subStatus: nextSubStatus, revived: isRevival },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/leads/[id]/status]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to update lead status" },
      { status: 500 }
    );
  }
}

function bad(message: string) {
  return NextResponse.json<ApiError>({ error: "Bad Request", message }, { status: 400 });
}
