// src/app/api/tasks/[id]/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StatusUpdatePayload } from "@/types/tasks";
import { ApiError } from "@/types/dashboard";

const LABEL_TO_STATUS: Record<string, string> = {
  "To Do": "TODO",
  "In Progress": "IN_PROGRESS",
  "Completed": "COMPLETED",
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

    const taskId = params.id;
    const body: StatusUpdatePayload = await request.json();
    const statusEnum = body?.status ? LABEL_TO_STATUS[body.status] : undefined;

    if (!statusEnum) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid status value" },
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

    // 🚩 Ownership check — same reused pattern as Deals' stage update.
    // Either the assignee, the creator, or an elevated role (Admin/Manager)
    // can flip a task's status. Without this, any authenticated user could
    // complete/reopen anyone's tasks by guessing task IDs.
    const isAssignee = existingTask.assignedTo === userId;
    const isCreator = existingTask.createdBy === userId;
    const isElevated = userRole === "ADMIN" || userRole === "MANAGER";

    if (!isAssignee && !isCreator && !isElevated) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to update this task" },
        { status: 403 }
      );
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { status: statusEnum as any },
    });

    return NextResponse.json(
      { success: true, message: "Status updated successfully", data: { id: updated.id, status: body.status } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/tasks/[id]/status]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to update task status" },
      { status: 500 }
    );
  }
}