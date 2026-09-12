// src/app/api/follow-ups/route.ts
//
// GET  /api/follow-ups — the Follow-up page's list: every follow-up any agent
//                        has set, within the caller's scope.
// POST /api/follow-ups — an agent setting a follow-up on a lead.
//
// Until this route existed nothing in the app could create a FollowUp row —
// only the seed did — so the Follow-up page would have been permanently empty
// no matter how many agents used it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveOwnerScope,
  ownerWhere,
  isInScope,
  parseDateParam,
  parseDateTime,
} from "@/lib/scope";
import {
  FollowUpsApiResponse,
  FollowUpResponse,
  FollowUpSummary,
  CreateFollowUpPayload,
  CreateFollowUpResponse,
} from "@/types/followups";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = {
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
  CALLBACK_REQUESTED: "Callback Requested",
  CONVERTED: "Converted",
};

const VALID_FILTERS = [
  "all", "planned", "pending", "done", "missed", "cancelled", "rescheduled",
] as const;

const followUpSelect = {
  id: true,
  scheduledAt: true,
  completedAt: true,
  status: true,
  outcome: true,
  notes: true,
  rescheduleCount: true,
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: { select: { companyName: true } },
    },
  },
  deal: { select: { title: true } },
  owner: { select: { name: true } },
} as const;

function shapeFollowUp(f: any, now: Date): FollowUpResponse {
  // Planned vs Pending is derived, never stored — see types/followups.ts.
  const isOverdue = f.status === "PENDING" && f.scheduledAt.getTime() < now.getTime();

  const status =
    f.status === "CANCELLED" ? "Cancelled"
    : f.status === "COMPLETED" ? "Done"
    : f.status === "MISSED" ? "Missed"
    : isOverdue ? "Pending"
    : "Planned";

  return {
    id: f.id,
    contactId: f.contact.id,
    contactName: `${f.contact.firstName} ${f.contact.lastName}`,
    company: f.contact.company?.companyName ?? null,
    dealTitle: f.deal?.title ?? null,
    agentName: f.owner.name,
    scheduledAt: f.scheduledAt.toISOString(),
    completedAt: f.completedAt ? f.completedAt.toISOString() : null,
    status,
    outcome: f.outcome ? (OUTCOME_LABEL[f.outcome] as any) ?? null : null,
    notes: f.notes,
    rescheduleCount: f.rescheduleCount,
    isOverdue,
  };
}

/**
 * Turns a pill filter into a Prisma `where` fragment.
 *
 * 🚩 Always combine this with the base filters via `AND`, never by spreading
 * it into the same object. "planned"/"pending" constrain `scheduledAt`, and so
 * does the from/to range — a spread would let whichever came last silently
 * replace the other, dropping the user's date range the moment they clicked
 * one of those two pills.
 */
function filterWhere(filter: string, now: Date) {
  switch (filter) {
    case "planned":
      return { status: "PENDING" as const, scheduledAt: { gte: now } };
    case "pending":
      return { status: "PENDING" as const, scheduledAt: { lt: now } };
    case "done":
      return { status: "COMPLETED" as const };
    case "missed":
      return { status: "MISSED" as const };
    case "cancelled":
      return { status: "CANCELLED" as const };
    case "rescheduled":
      return { rescheduleCount: { gt: 0 } };
    default:
      return {};
  }
}

// ── GET /api/follow-ups ──────────────────────────────────────────────────────
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
    const filter = searchParams.get("filter")?.trim().toLowerCase() ?? "all";
    const agent = searchParams.get("agent")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "scheduledAt";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    if (!VALID_FILTERS.includes(filter as any)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: `Invalid filter. Use one of: ${VALID_FILTERS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!["scheduledAt", "scheduledAtAsc", "createdAt"].includes(sort)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid sort field. Use: scheduledAt, scheduledAtAsc, or createdAt" },
        { status: 400 }
      );
    }

    const from = parseDateParam(searchParams.get("from"), "start");
    const to = parseDateParam(searchParams.get("to"), "end");

    if (from && to && from.getTime() > to.getTime()) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "`from` must be on or before `to`" },
        { status: 400 }
      );
    }

    // 🚩 Scope first — a rep must never see another rep's follow-ups by
    // paging through this list, and the `agent` filter must narrow WITHIN
    // that scope rather than escape it.
    const ownerIds = await resolveOwnerScope(userId, userRole);

    if (agent && !isInScope(ownerIds, agent)) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to view that agent's follow-ups" },
        { status: 403 }
      );
    }

    const scope = agent ? { ownerId: agent } : ownerWhere(ownerIds);

    // Search by lead name — same multi-word handling as Contacts/Deals, where
    // "John Smith" spans two columns and a plain per-column OR misses it.
    const tokens = search.split(/\s+/).filter(Boolean);
    const fullNameFilter =
      tokens.length >= 2
        ? [{
            contact: {
              AND: [
                { firstName: { contains: tokens[0], mode: "insensitive" as const } },
                { lastName: { contains: tokens.slice(1).join(" "), mode: "insensitive" as const } },
              ],
            },
          }]
        : [];

    const searchFilter = search
      ? {
          OR: [
            { contact: { firstName: { contains: search, mode: "insensitive" as const } } },
            { contact: { lastName: { contains: search, mode: "insensitive" as const } } },
            { contact: { email: { contains: search, mode: "insensitive" as const } } },
            { contact: { company: { is: { companyName: { contains: search, mode: "insensitive" as const } } } } },
            ...fullNameFilter,
          ],
        }
      : {};

    const dateFilter = from || to
      ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};

    const now = new Date();

    // Base = everything EXCEPT the status pill, so the pill counts describe
    // the rows the current search/agent/date filters can reach. Counting them
    // against the fully-filtered set would make every pill but the active one
    // read 0.
    const base = { ...scope, ...searchFilter, ...dateFilter };
    const where = { AND: [base, filterWhere(filter, now)] };

    const [total, summary, rows] = await Promise.all([
      prisma.followUp.count({ where }),
      buildSummary(base, now),
      prisma.followUp.findMany({
        where,
        select: followUpSelect,
        // Soonest-first by default: an agent opening this page cares about
        // what's coming up, not what happened longest ago.
        orderBy:
          sort === "createdAt" ? { createdAt: "desc" as const }
          : sort === "scheduledAtAsc" ? { scheduledAt: "asc" as const }
          : { scheduledAt: "desc" as const },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const response: FollowUpsApiResponse = {
      success: true,
      message: total === 0 ? "No Follow-up" : "Follow-ups fetched successfully",
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary,
      data: rows.map((r) => shapeFollowUp(r, now)),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/follow-ups]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch follow-ups" },
      { status: 500 }
    );
  }
}

async function buildSummary(base: object, now: Date): Promise<FollowUpSummary> {
  // Each pill's count is built from the SAME fragment the pill itself filters
  // by, AND-ed onto the base, so a count can never describe a different set of
  // rows than clicking that pill would show.
  const withFilter = (filter: string) => ({ AND: [base, filterWhere(filter, now)] });

  const [byStatus, total, planned, pending, rescheduled] = await Promise.all([
    prisma.followUp.groupBy({ by: ["status"], where: base, _count: { id: true } }),
    prisma.followUp.count({ where: base }),
    prisma.followUp.count({ where: withFilter("planned") }),
    prisma.followUp.count({ where: withFilter("pending") }),
    prisma.followUp.count({ where: withFilter("rescheduled") }),
  ]);

  const count = new Map(byStatus.map((r) => [r.status, r._count.id]));

  return {
    total,
    planned,
    pending,
    done: count.get("COMPLETED") ?? 0,
    missed: count.get("MISSED") ?? 0,
    cancelled: count.get("CANCELLED") ?? 0,
    rescheduled,
  };
}

// ── POST /api/follow-ups ─────────────────────────────────────────────────────
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

    const body: CreateFollowUpPayload = await request.json();

    if (!body.contactId) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Lead is mandatory" },
        { status: 400 }
      );
    }
    if (!body.scheduledDate) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Follow-up date is mandatory" },
        { status: 400 }
      );
    }

    const scheduledAt = parseDateTime(body.scheduledDate, body.scheduledTime);
    if (!scheduledAt) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid follow-up date or time" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({ where: { id: body.contactId } });
    if (!contact) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid lead" },
        { status: 400 }
      );
    }

    // 🚩 Owner assignment — the same hierarchy rule used by Contacts, Deals
    // and Tasks. Self always allowed, ADMIN can assign to anyone, otherwise
    // the owner must be a direct report. Without it any agent could plant
    // follow-ups in another agent's queue by passing their ID.
    const ownerId = body.ownerId ?? userId;
    if (ownerId !== userId && userRole !== "ADMIN") {
      const isDirectReport = await prisma.user.findFirst({
        where: { id: ownerId, managerId: userId },
      });
      if (!isDirectReport) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid agent" },
          { status: 400 }
        );
      }
    }

    // A linked deal must belong to the same lead — otherwise the list would
    // show a follow-up captioned with some unrelated contact's deal.
    if (body.dealId) {
      const deal = await prisma.deal.findUnique({ where: { id: body.dealId } });
      if (!deal) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "Invalid related deal" },
          { status: 400 }
        );
      }
      if (deal.contactId !== body.contactId) {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "That deal belongs to a different lead" },
          { status: 400 }
        );
      }
    }

    // The follow-up and the lead-timeline entry for it are written together:
    // the Leads module promises a lead's history is complete, and a scheduled
    // touchpoint that never shows up on the lead it was scheduled against
    // would quietly break that promise. Added when the Leads module shipped —
    // every existing caller of this route (the Follow-up page, the Contacts
    // row button) gets the timeline entry for free.
    const created = await prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.create({
        data: {
          contactId: body.contactId,
          dealId: body.dealId ?? null,
          ownerId,
          scheduledAt,
          notes: body.notes?.trim() || null,
          // status defaults to PENDING; it reads as "Planned" until its time
          // passes, with no write needed to flip it.
        },
        select: followUpSelect,
      });

      await tx.leadHistory.create({
        data: {
          contactId: body.contactId,
          userId,
          type: "FOLLOW_UP_SCHEDULED",
          toValue: scheduledAt.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
          }),
          remark: body.notes?.trim() || null,
        },
      });

      return followUp;
    });

    const response: CreateFollowUpResponse = {
      success: true,
      message: "Follow-up scheduled successfully",
      data: shapeFollowUp(created, new Date()),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[POST /api/follow-ups]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to schedule follow-up" },
      { status: 500 }
    );
  }
}
