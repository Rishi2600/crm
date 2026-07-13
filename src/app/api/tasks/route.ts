// src/app/api/tasks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TasksApiResponse,
  TaskResponse,
  CreateTaskPayload,
  CreateTaskResponse,
} from "@/types/tasks";
import { ApiError } from "@/types/dashboard";

const PRIORITY_LABEL: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const LABEL_TO_PRIORITY: Record<string, string> = { High: "HIGH", Medium: "MEDIUM", Low: "LOW" };

const STATUS_LABEL: Record<string, string> = { TODO: "To Do", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
// Lenient — story's filter example uses lowercase, no-space values ("todo"),
// while create/status-update payloads use the human label ("To Do"). Accept both.
const FILTER_TO_STATUS: Record<string, string> = {
  todo: "TODO", "to do": "TODO", "to-do": "TODO",
  inprogress: "IN_PROGRESS", "in progress": "IN_PROGRESS", "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
};

const TYPE_LABEL: Record<string, string> = { STANDARD: "Standard", MEETING: "Meeting" };

const taskSelect = {
  id: true, title: true, description: true, priority: true, status: true, type: true,
  dueDate: true,
  assignee: { select: { name: true } },
  relatedDeal: { select: { title: true } },
} as const;

function shapeTask(t: any): TaskResponse {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: PRIORITY_LABEL[t.priority] ?? t.priority,
    status: STATUS_LABEL[t.status] ?? t.status,
    type: TYPE_LABEL[t.type] ?? t.type,
    dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
    assignedTo: t.assignee.name,
    relatedDeal: t.relatedDeal?.title ?? null,
  };
}

// ── GET /api/tasks — list, search, filter, paginate ─────────────────────────
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
    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    // ── Scope — "the authenticated user's tasks" per story, extended with
    // the same reused ownership pattern as Contacts/Deals: 🚩 flagged as an
    // assumption, not explicitly specified for Tasks in the story.
    // ADMIN: sees everything. MANAGER: sees own + direct reports' tasks.
    // SALES_REP: sees only tasks they're assigned to or created.
    let scopeFilter: any;
    if (userRole === "ADMIN") {
      scopeFilter = {};
    } else if (userRole === "MANAGER") {
      const reports = await prisma.user.findMany({ where: { managerId: userId }, select: { id: true } });
      const scopedIds = [userId, ...reports.map((r) => r.id)];
      scopeFilter = { OR: [{ assignedTo: { in: scopedIds } }, { createdBy: { in: scopedIds } }] };
    } else {
      scopeFilter = { OR: [{ assignedTo: userId }, { createdBy: userId }] };
    }

    // ── Status filter ────────────────────────────────────────────────────────
    let statusEnum: string | undefined;
    if (statusFilter && statusFilter !== "all") {
      statusEnum = FILTER_TO_STATUS[statusFilter];
      if (!statusEnum) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid status filter" },
          { status: 400 }
        );
      }
    }

    // ── Search — title, related deal title, assignee name ──────────────────
    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { assignee: { name: { contains: search, mode: "insensitive" as const } } },
            { relatedDeal: { is: { title: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {};

    const where = {
      ...scopeFilter,
      ...searchFilter,
      ...(statusEnum ? { status: statusEnum } : {}),
    };

    const total = await prisma.task.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // title/dueDate/createdAt are all real stored columns — DB-level
    // pagination works natively here, same as Deals, unlike Contacts'
    // computed-dealValue special case.
    const tasks = await prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const response: TasksApiResponse = {
      success: true,
      message: total === 0 ? "No tasks found" : "Tasks fetched successfully",
      page,
      limit,
      total,
      totalPages,
      data: tasks.map(shapeTask),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/tasks]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// ── POST /api/tasks — create ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    const body: CreateTaskPayload = await request.json();

    // ── Mandatory field validation — per story ──────────────────────────────
    if (!body.title?.trim()) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Title is mandatory" }, { status: 400 });
    }
    if (!body.dueDate) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Due Date is mandatory" }, { status: 400 });
    }
    if (!body.assignedTo) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Assigned User is mandatory" }, { status: 400 });
    }

    // ── Priority validation ──────────────────────────────────────────────────
    const priorityEnum = body.priority ? LABEL_TO_PRIORITY[body.priority] : "MEDIUM";
    if (!priorityEnum) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Invalid priority" }, { status: 400 });
    }

    // ── Assignee must exist ──────────────────────────────────────────────────
    const assignee = await prisma.user.findUnique({ where: { id: body.assignedTo } });
    if (!assignee) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Invalid Assigned User" }, { status: 400 });
    }

    // 🚩 Reporting-hierarchy check — the core authorization rule this whole
    // module hinges on. Without this, any user could assign a task to any
    // other user ID in the system, sidestepping the hierarchy entirely —
    // same class of IDOR risk closed on Deals' stage-update endpoint.
    // Self-assignment always allowed. ADMIN can assign to anyone. Otherwise
    // (MANAGER/SALES_REP), assignedTo must be a direct report.
    const isSelf = body.assignedTo === userId;
    const isAdmin = userRole === "ADMIN";
    if (!isSelf && !isAdmin) {
      const isDirectReport = await prisma.user.findFirst({
        where: { id: body.assignedTo, managerId: userId },
      });
      if (!isDirectReport) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid Assigned User" },
          { status: 400 }
        );
      }
    }

    // ── Related deal, if provided, must exist ───────────────────────────────
    if (body.relatedDealId) {
      const deal = await prisma.deal.findUnique({ where: { id: body.relatedDealId } });
      if (!deal) {
        return NextResponse.json<ApiError>({ error: "Bad Request", message: "Invalid related deal" }, { status: 400 });
      }
    }

    // ── Meeting-specific validation ──────────────────────────────────────────
    const isMeeting = body.type === "Meeting";
    if (isMeeting && (!body.meetingDate || !body.meetingTime || !body.location)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Meeting Date, Meeting Time, and Location are required for meeting tasks" },
        { status: 400 }
      );
    }

    // ── Create ────────────────────────────────────────────────────────────────
    const created = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: body.description ?? null,
        priority: priorityEnum as any,
        dueDate: new Date(body.dueDate),
        assignedTo: body.assignedTo,
        createdBy: userId,
        relatedDealId: body.relatedDealId ?? null,
        type: isMeeting ? ("MEETING" as any) : ("STANDARD" as any),
        ...(isMeeting
          ? {
              activities: {
                create: {
                  activityType: "MEETING" as any,
                  meetingDate: new Date(body.meetingDate!),
                  meetingTime: body.meetingTime,
                  location: body.location,
                  notes: body.notes ?? null,
                  createdBy: userId,
                },
              },
            }
          : {}),
      },
      select: taskSelect,
    });

    const response: CreateTaskResponse = {
      success: true,
      message: "Task created successfully",
      data: shapeTask(created),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tasks]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to create task" },
      { status: 500 }
    );
  }
}