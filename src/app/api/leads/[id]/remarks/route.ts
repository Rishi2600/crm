// src/app/api/leads/[id]/remarks/route.ts
// POST — adds a standalone remark to a lead's timeline.
//
// Separate from the remark the status route demands: that one explains a
// transition and is stored ON it, this one is a note an agent leaves without
// anything else changing ("spoke to the receptionist, call back after 5"). Both
// land in the same LeadHistory timeline, which is why the detail view's
// "Last Lead Remark" panel can show whichever came last without caring which
// kind it was.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwnerScope, isInScope } from "@/lib/scope";
import { shapeHistory } from "@/lib/leads";
import { AddRemarkPayload } from "@/types/leads";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

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

    const body: AddRemarkPayload = await request.json();
    const remark = body.remark?.trim();

    if (!remark) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Remark cannot be empty" },
        { status: 400 }
      );
    }
    if (remark.length > 2000) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Remark is too long (2000 characters maximum)" },
        { status: 400 }
      );
    }

    const lead = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true },
    });

    if (!lead) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Lead Not Found" },
        { status: 404 }
      );
    }

    // 🚩 Same ownership rule as every other lead write — a remark is part of
    // the permanent record, so who may add one is not a looser question than
    // who may edit the lead.
    // 🚩 Scoped to the caller's OWN TEAM, not merely "are you a manager".
    // This used to be `isOwner || ADMIN || MANAGER`, which never looked at
    // WHOSE record it was — so a manager could edit leads belonging to a
    // different manager's team, including ones the read endpoints correctly
    // refused to show them. isInScope asks the same question the list
    // endpoints ask, so read access and write access can no longer disagree.
    const ownerIds = await resolveOwnerScope(userId, userRole);
    if (!isInScope(ownerIds, lead.ownerId)) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to add a remark to this lead" },
        { status: 403 }
      );
    }

    const created = await prisma.leadHistory.create({
      data: { contactId: lead.id, userId, type: "REMARK_ADDED", remark },
      select: {
        id: true,
        type: true,
        fromValue: true,
        toValue: true,
        remark: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(
      { success: true, message: "Remark added", data: shapeHistory(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/leads/[id]/remarks]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to add remark" },
      { status: 500 }
    );
  }
}
