// src/app/api/tasks/[id]/attendees/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwnerScope, isInScope } from "@/lib/scope";
import { SaveAttendeesPayload } from "@/types/tasks";
import { ApiError } from "@/types/dashboard";

export async function POST(
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

    const taskId = params.id;
    const body: SaveAttendeesPayload = await request.json();
    const attendeeIds = body?.attendees ?? [];

    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "attendees must be a non-empty array of contact IDs" },
        { status: 400 }
      );
    }

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Task Not Found" },
        { status: 404 }
      );
    }

    // Same ownership rule as the status-update endpoint — 🚩 flagged as
    // reused rather than independently designed for this specific action.
    // 🚩 Scoped to the caller's own team. A task has no `ownerId` — it is
    // "owned" by whoever it is assigned to OR whoever created it, so either
    // side being in scope grants access. Previously any manager could act on
    // any task in the company, including teams whose tasks the list endpoint
    // refused to show them.
    const ownerIds = await resolveOwnerScope(userId, userRole);
    const inScope =
      isInScope(ownerIds, existingTask.assignedTo) ||
      isInScope(ownerIds, existingTask.createdBy);
    if (!inScope) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to update this task" },
        { status: 403 }
      );
    }

    // ── Validate every attendee ID actually exists in Contacts — the story
    // is explicit that arbitrary/manually-entered attendees must never be
    // allowed. All-or-nothing: if ANY id is invalid, reject the whole
    // request rather than silently dropping bad ones. ──────────────────────
    const existingContacts = await prisma.contact.findMany({
      where: { id: { in: attendeeIds } },
      select: { id: true },
    });

    if (existingContacts.length !== attendeeIds.length) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid Attendee" },
        { status: 400 }
      );
    }

    // skipDuplicates handles re-submitting the same attendee list safely
    // (e.g. user re-saves without changes) — the @@unique([taskId, contactId])
    // constraint on TaskAttendee is what skipDuplicates checks against.
    await prisma.taskAttendee.createMany({
      data: attendeeIds.map((contactId) => ({ taskId, contactId })),
      skipDuplicates: true,
    });

    return NextResponse.json(
      { success: true, message: "Attendees saved successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/tasks/[id]/attendees]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to save attendees" },
      { status: 500 }
    );
  }
}