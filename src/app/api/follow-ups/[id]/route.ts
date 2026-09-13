// src/app/api/follow-ups/[id]/route.ts
// PATCH — the three things an agent does to a follow-up after setting it:
// mark it Done (with an outcome), write it off as Missed/Cancelled, or
// reschedule it to a new date.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateTime, resolveOwnerScope, isInScope } from "@/lib/scope";
import { UpdateFollowUpPayload } from "@/types/followups";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

const LABEL_TO_STATUS: Record<string, "PENDING" | "COMPLETED" | "MISSED" | "CANCELLED"> = {
  Pending: "PENDING",
  Done: "COMPLETED",
  Missed: "MISSED",
  Cancelled: "CANCELLED",
};

const LABEL_TO_OUTCOME: Record<string, string> = {
  "Connected": "CONNECTED",
  "Not Connected": "NOT_CONNECTED",
  "Interested": "INTERESTED",
  "Not Interested": "NOT_INTERESTED",
  "Callback Requested": "CALLBACK_REQUESTED",
  "Converted": "CONVERTED",
};

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

    const body: UpdateFollowUpPayload = await request.json();

    // ── Validate the payload BEFORE touching the DB ────────────────────────
    let statusEnum: string | undefined;
    if (body.status !== undefined) {
      statusEnum = LABEL_TO_STATUS[body.status];
      if (!statusEnum) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid status value" },
          { status: 400 }
        );
      }
    }

    let outcomeEnum: string | undefined;
    if (body.outcome !== undefined) {
      outcomeEnum = LABEL_TO_OUTCOME[body.outcome];
      if (!outcomeEnum) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid outcome value" },
          { status: 400 }
        );
      }
    }

    let rescheduledAt: Date | undefined;
    if (body.scheduledDate) {
      rescheduledAt = parseDateTime(body.scheduledDate, body.scheduledTime);
      if (!rescheduledAt) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid follow-up date or time" },
          { status: 400 }
        );
      }
    }

    if (
      body.status === undefined &&
      body.outcome === undefined &&
      body.notes === undefined &&
      !rescheduledAt
    ) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Nothing to update" },
        { status: 400 }
      );
    }

    // An outcome only means something on a completed follow-up — a pending one
    // hasn't happened yet and a cancelled one never will.
    if (outcomeEnum && statusEnum && statusEnum !== "COMPLETED") {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "An outcome can only be set when marking a follow-up Done" },
        { status: 400 }
      );
    }

    const existing = await prisma.followUp.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Follow-up Not Found" },
        { status: 404 }
      );
    }

    // 🚩 Ownership — same rule as the task status and deal stage endpoints.
    // Without it any authenticated user could close or cancel another agent's
    // follow-ups by guessing IDs.
    // 🚩 Scoped to the caller's OWN TEAM, not merely "are you a manager".
    // This used to be `isOwner || ADMIN || MANAGER`, which never looked at
    // WHOSE record it was — so a manager could edit follow-ups belonging to a
    // different manager's team, including ones the read endpoints correctly
    // refused to show them. isInScope asks the same question the list
    // endpoints ask, so read access and write access can no longer disagree.
    const ownerIds = await resolveOwnerScope(userId, userRole);
    if (!isInScope(ownerIds, existing.ownerId)) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to update this follow-up" },
        { status: 403 }
      );
    }

    if (outcomeEnum && !statusEnum && existing.status !== "COMPLETED") {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "An outcome can only be set on a follow-up that is Done" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};

    if (body.notes !== undefined) data.notes = body.notes.trim() || null;
    if (outcomeEnum) data.outcome = outcomeEnum;

    // Rescheduling moves the date, counts the move, and puts the follow-up
    // back in play — moving a missed one to next week means it's pending
    // again, not still missed.
    if (rescheduledAt) {
      data.scheduledAt = rescheduledAt;
      data.rescheduleCount = existing.rescheduleCount + 1;
      data.status = "PENDING";
      data.completedAt = null;
    }

    // An explicit status in the same request wins over the reschedule's
    // implicit PENDING.
    if (statusEnum) {
      data.status = statusEnum;
      // completedAt is the source of truth for "when did this actually
      // happen" — set it on the way into Done and clear it on the way out,
      // so it can never describe a follow-up that is no longer done.
      data.completedAt = statusEnum === "COMPLETED" ? new Date() : null;
      if (statusEnum !== "COMPLETED") data.outcome = null;
    }

    await prisma.followUp.update({ where: { id: params.id }, data });

    return NextResponse.json(
      { success: true, message: rescheduledAt ? "Follow-up rescheduled" : "Follow-up updated" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/follow-ups/[id]]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to update follow-up" },
      { status: 500 }
    );
  }
}
