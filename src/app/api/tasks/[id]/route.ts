// src/app/api/tasks/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/types/dashboard";

export async function DELETE(
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

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Task Not Found" },
        { status: 404 }
      );
    }

    // Same ownership rule as the status-update and attendees endpoints for
    // this task — assignee, creator, or an elevated role (Admin/Manager).
    const isAssignee = existingTask.assignedTo === userId;
    const isCreator = existingTask.createdBy === userId;
    const isElevated = userRole === "ADMIN" || userRole === "MANAGER";
    if (!isAssignee && !isCreator && !isElevated) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to delete this task" },
        { status: 403 }
      );
    }

    // Unlike Contacts (blocked if deals exist), a task's child records —
    // TaskActivity (meeting details) and TaskAttendee (attendee list) —
    // are entirely subordinate to the task itself. Deleting them together
    // with the task is safe and expected, not a data-loss risk; done in one
    // transaction so it's all-or-nothing.
    await prisma.$transaction([
      prisma.taskActivity.deleteMany({ where: { taskId } }),
      prisma.taskAttendee.deleteMany({ where: { taskId } }),
      prisma.task.delete({ where: { id: taskId } }),
    ]);

    return NextResponse.json(
      { success: true, message: "Task deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/tasks/[id]]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to delete task" },
      { status: 500 }
    );
  }
}