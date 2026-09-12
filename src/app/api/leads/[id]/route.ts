// src/app/api/leads/[id]/route.ts
//
// GET   /api/leads/[id] — the lead detail view: the lead plus its complete
//                         history, the assignment trail and its last remark.
// PATCH /api/leads/[id] — editing a lead's details.
//
// Status and sub-status are NOT editable here. They move through
// /api/leads/[id]/status, which refuses to act without a remark — so no code
// path exists that can change a lead's status without recording why.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwnerScope, isInScope } from "@/lib/scope";
import {
  leadSelect,
  shapeLead,
  shapeHistory,
  LABEL_TO_TEMPERATURE,
  LABEL_TO_SOURCE,
  parseLeadScore,
} from "@/lib/leads";
import { LeadDetail, LeadDetailResponse, UpdateLeadPayload } from "@/types/leads";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

const historySelect = {
  id: true,
  type: true,
  fromValue: true,
  toValue: true,
  remark: true,
  createdAt: true,
  user: { select: { name: true } },
} as const;

// ── GET /api/leads/[id] ──────────────────────────────────────────────────────
export async function GET(
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

    const lead = await prisma.contact.findUnique({
      where: { id: params.id },
      select: leadSelect,
    });

    if (!lead) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Lead Not Found" },
        { status: 404 }
      );
    }

    // 🚩 Scope is checked on the OWNER of the row, not on the list query —
    // a rep who knows a lead's id must not be able to read it by navigating
    // straight to the detail URL and skipping the list entirely.
    const ownerIds = await resolveOwnerScope(userId, userRole);
    if (!isInScope(ownerIds, lead.owner.id)) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to view this lead" },
        { status: 403 }
      );
    }

    const now = new Date();

    const [history, nextFollowUp, lastFollowUp] = await Promise.all([
      prisma.leadHistory.findMany({
        where: { contactId: lead.id },
        select: historySelect,
        orderBy: { createdAt: "desc" },
      }),
      prisma.followUp.findFirst({
        where: { contactId: lead.id, status: "PENDING", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true },
      }),
      // Last ACTIONED touchpoint — a completed follow-up, newest first. A
      // still-pending one hasn't happened yet, so counting it here would make
      // "Last Follow-up" describe a conversation nobody has had.
      prisma.followUp.findFirst({
        where: { contactId: lead.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, scheduledAt: true },
      }),
    ]);

    const entries = history.map(shapeHistory);

    const data: LeadDetail = {
      ...shapeLead(lead, nextFollowUp?.scheduledAt ?? null, now),
      history: entries,
      // One query, sliced three ways — the timeline, the assignment-only view
      // behind the Assignment Trail icon, and the newest remark for the
      // "Last Lead Remark" panel. Three queries would return the same rows.
      assignmentTrail: entries.filter((e) => e.type === "Assigned" || e.type === "Created"),
      lastRemark: entries.find((e) => e.remark) ?? null,
      lastFollowUpAt:
        (lastFollowUp?.completedAt ?? lastFollowUp?.scheduledAt)?.toISOString() ?? null,
    };

    return NextResponse.json<LeadDetailResponse>(
      { success: true, message: "Lead fetched successfully", data },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/leads/[id]]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/leads/[id] ────────────────────────────────────────────────────
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

    const body: UpdateLeadPayload = await request.json();

    // ── Validate everything BEFORE the first write ──────────────────────────
    const data: Record<string, unknown> = {};

    if (body.firstName !== undefined) {
      if (!body.firstName.trim()) {
        return bad("First name cannot be empty");
      }
      data.firstName = body.firstName.trim();
    }

    if (body.lastName !== undefined) {
      if (!body.lastName.trim()) return bad("Last name cannot be empty");
      data.lastName = body.lastName.trim();
    }

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Invalid email address");
      data.email = email;
    }

    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.location !== undefined) data.location = body.location?.trim() || null;
    if (body.sourceName !== undefined) data.sourceName = body.sourceName?.trim() || null;

    if (body.temperature !== undefined) {
      const t = LABEL_TO_TEMPERATURE[body.temperature];
      if (!t) return bad(`Invalid temperature "${body.temperature}"`);
      data.leadStatus = t;
    }

    if (body.source !== undefined) {
      const s = LABEL_TO_SOURCE[body.source];
      if (!s) return bad(`Invalid source "${body.source}"`);
      data.leadSource = s;
    }

    if (body.leadScore !== undefined) {
      const score = parseLeadScore(body.leadScore);
      if (score === undefined) return bad("Lead score must be a number between 0 and 100");
      data.leadScore = score;
    }

    // Company by name, find-or-create — same behaviour as lead creation, so
    // editing a company name here and typing it on the Add Lead form land on
    // the same Company row rather than creating a near-duplicate.
    if (body.companyName !== undefined) {
      const name = body.companyName?.trim();
      if (!name) {
        data.companyId = null;
      } else {
        const existing = await prisma.company.findFirst({
          where: { companyName: { equals: name, mode: "insensitive" } },
        });
        data.companyId = existing
          ? existing.id
          : (await prisma.company.create({ data: { companyName: name } })).id;
      }
    }

    if (Object.keys(data).length === 0 && body.ownerId === undefined) {
      return bad("Nothing to update");
    }

    const existing = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, owner: { select: { name: true } } },
    });

    if (!existing) {
      return NextResponse.json<ApiError>(
        { error: "Not Found", message: "Lead Not Found" },
        { status: 404 }
      );
    }

    // 🚩 Ownership — the rule reused from the deal-stage, task-status and
    // follow-up endpoints: the owner can edit their own lead, ADMIN and
    // MANAGER can edit within theirs, nobody else can touch it.
    const isOwner = existing.ownerId === userId;
    const isElevated = userRole === "ADMIN" || userRole === "MANAGER";
    if (!isOwner && !isElevated) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to edit this lead" },
        { status: 403 }
      );
    }

    // Reassignment goes through the same hierarchy check as creation, and is
    // recorded as its own timeline entry — that entry IS the Assignment Trail.
    let reassignedTo: { id: string; name: string } | null = null;
    if (body.ownerId !== undefined && body.ownerId !== existing.ownerId) {
      const target = await prisma.user.findUnique({
        where: { id: body.ownerId },
        select: { id: true, name: true, managerId: true },
      });
      if (!target) return bad("Invalid agent");
      if (target.id !== userId && userRole !== "ADMIN" && target.managerId !== userId) {
        return bad("Invalid agent");
      }
      data.ownerId = target.id;
      reassignedTo = { id: target.id, name: target.name };
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.update({
          where: { id: params.id },
          data,
          select: leadSelect,
        });

        // Only the fields that aren't the owner count as a details edit, so
        // a pure reassignment doesn't also log a meaningless "Details
        // Updated" entry next to its "Assigned" one.
        const editedFields = Object.keys(data).filter((k) => k !== "ownerId");
        if (editedFields.length > 0) {
          await tx.leadHistory.create({
            data: {
              contactId: contact.id,
              userId,
              type: "DETAILS_UPDATED",
              toValue: editedFields.map(fieldLabel).join(", "),
            },
          });
        }

        if (reassignedTo) {
          await tx.leadHistory.create({
            data: {
              contactId: contact.id,
              userId,
              type: "ASSIGNED",
              fromValue: existing.owner.name,
              toValue: reassignedTo.name,
            },
          });
        }

        return contact;
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return bad("A lead with this email already exists");
      }
      throw err;
    }

    return NextResponse.json(
      { success: true, message: "Lead updated successfully", data: shapeLead(updated, null) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/leads/[id]]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to update lead" },
      { status: 500 }
    );
  }
}

function bad(message: string) {
  return NextResponse.json<ApiError>({ error: "Bad Request", message }, { status: 400 });
}

/** Turns a Prisma column name into something a person reads in the timeline —
 *  "Details Updated: leadStatus, companyId" is not an audit entry anyone can
 *  use. */
function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    phone: "Phone",
    location: "Location",
    companyId: "Company",
    leadStatus: "Temperature",
    leadSource: "Source",
    sourceName: "Source Name",
    leadScore: "Lead Score",
  };
  return labels[field] ?? field;
}
