// src/app/api/users/assignable/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssignableUsersResponse } from "@/types/tasks";
import { ApiError } from "@/types/dashboard";

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

    // 🚩 Hierarchy depth: direct reports ONLY, not the full recursive
    // subtree (a manager-of-managers scenario would need a recursive query
    // — deliberately out of scope for now, flagged in the audit).
    //
    // 🚩 ADMIN extension: the story's example only covers a Manager→direct
    // reports case. Since an ADMIN is implicitly "authorized over everyone,"
    // restricting them to only their own direct reports (likely zero, if
    // admins don't have anyone reporting to them in the org chart) would
    // make the dropdown practically useless for an admin. Extending ADMIN to
    // see all active users — an assumption, not explicitly specified.
    let users;

    if (userRole === "ADMIN") {
      users = await prisma.user.findMany({
        where: { status: "ACTIVE", id: { not: userId } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
    } else {
      const directReports = await prisma.user.findMany({
        where: { managerId: userId, status: "ACTIVE" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      users = directReports;
    }

    // Self is always assignable — "a user can create tasks for themselves"
    const self = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (self) users = [self, ...users];

    const response: AssignableUsersResponse = { success: true, data: users };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/users/assignable]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch assignable users" },
      { status: 500 }
    );
  }
}