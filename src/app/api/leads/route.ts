// src/app/api/leads/route.ts
//
// GET  /api/leads — the Leads page's table: every lead in the caller's scope,
//                   with the same search + filter surface as the reference.
// POST /api/leads — the "Add Lead" button.
//
// A "lead" is a Contact read through its lead-lifecycle columns. It is
// deliberately the SAME table the Contacts page reads, not a copy: a lead that
// converts doesn't get re-keyed into a contact, it just changes status, and
// every deal, task and follow-up already hanging off that contact stays
// attached. Two tables would have meant reconciling them forever.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwnerScope, ownerWhere, isInScope, parseDateParam } from "@/lib/scope";
import {
  leadSelect,
  shapeLead,
  LABEL_TO_STATUS,
  LABEL_TO_SUB_STATUS,
  LABEL_TO_SOURCE,
  parseLeadScore,
} from "@/lib/leads";
import { prepareLead } from "@/lib/leads.server";
import { LeadsApiResponse, LeadSummary, CreateLeadPayload } from "@/types/leads";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

const SORTS = ["createdAt", "createdAtAsc", "name", "leadScore"] as const;

// ── GET /api/leads ───────────────────────────────────────────────────────────
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
    const statusParam = searchParams.get("status")?.trim() ?? "";
    const subStatusParam = searchParams.get("subStatus")?.trim() ?? "";
    const sourceParam = searchParams.get("source")?.trim() ?? "";
    const agent = searchParams.get("agent")?.trim() ?? "";
    const location = searchParams.get("location")?.trim() ?? "";
    const reEnquiredOnly = searchParams.get("reEnquired") === "true";
    const sort = searchParams.get("sort") ?? "createdAt";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    if (!SORTS.includes(sort as any)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: `Invalid sort field. Use one of: ${SORTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Filters arrive as display labels, the same strings the dropdowns show.
    const statusEnum = statusParam ? LABEL_TO_STATUS[statusParam] : undefined;
    if (statusParam && !statusEnum) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid status filter" },
        { status: 400 }
      );
    }

    const subStatusEnum = subStatusParam ? LABEL_TO_SUB_STATUS[subStatusParam] : undefined;
    if (subStatusParam && !subStatusEnum) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid sub-status filter" },
        { status: 400 }
      );
    }

    const sourceEnum = sourceParam ? LABEL_TO_SOURCE[sourceParam] : undefined;
    if (sourceParam && !sourceEnum) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid source filter" },
        { status: 400 }
      );
    }

    const minScore = parseLeadScore(searchParams.get("minScore"));
    const maxScore = parseLeadScore(searchParams.get("maxScore"));
    if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "`minScore` must be less than or equal to `maxScore`" },
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

    // 🚩 Scope first — a rep must never reach another rep's leads by paging
    // through this list, and the Agent filter narrows WITHIN that scope
    // rather than escaping it. Same rule as the Follow-up list.
    const ownerIds = await resolveOwnerScope(userId, userRole);

    if (agent && !isInScope(ownerIds, agent)) {
      return NextResponse.json<ApiError>(
        { error: "Forbidden", message: "You are not authorized to view that agent's leads" },
        { status: 403 }
      );
    }

    const scope = agent ? { ownerId: agent } : ownerWhere(ownerIds);

    // Multi-word name search — same two-column handling as Contacts/Deals,
    // where "John Smith" spans firstName and lastName and a plain per-column
    // OR misses it entirely.
    const tokens = search.split(/\s+/).filter(Boolean);
    const fullNameFilter =
      tokens.length >= 2
        ? [{
            AND: [
              { firstName: { contains: tokens[0], mode: "insensitive" as const } },
              { lastName: { contains: tokens.slice(1).join(" "), mode: "insensitive" as const } },
            ],
          }]
        : [];

    const searchFilter = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { sourceName: { contains: search, mode: "insensitive" as const } },
            { company: { is: { companyName: { contains: search, mode: "insensitive" as const } } } },
            ...fullNameFilter,
          ],
        }
      : {};

    const scoreFilter =
      minScore !== undefined || maxScore !== undefined
        ? { leadScore: { ...(minScore !== undefined ? { gte: minScore } : {}), ...(maxScore !== undefined ? { lte: maxScore } : {}) } }
        : {};

    const dateFilter =
      from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {};

    // Base = every filter EXCEPT status, so the status pill counts describe
    // the rows the current search/agent/date filters can reach. Counting them
    // against the fully-filtered set would make every pill but the active
    // one read 0 — the same trap the Follow-up summary avoids.
    const base = {
      ...scope,
      ...searchFilter,
      ...scoreFilter,
      ...dateFilter,
      ...(subStatusEnum ? { leadSubStatus: subStatusEnum as any } : {}),
      ...(sourceEnum ? { leadSource: sourceEnum as any } : {}),
      ...(location ? { location: { contains: location, mode: "insensitive" as const } } : {}),
    };

    // 🚩 Status and Re-Enquired are applied ON TOP of `base`, never folded
    // into it — they're what the pills select, and a pill's own filter must be
    // excluded from the set its count is measured against.
    const where = {
      ...base,
      ...(statusEnum ? { leadStage: statusEnum as any } : {}),
      ...(reEnquiredOnly ? { reEnquiryCount: { gt: 0 } } : {}),
    };

    const orderBy =
      sort === "name" ? { firstName: "asc" as const }
      : sort === "leadScore" ? { leadScore: "desc" as const }
      : sort === "createdAtAsc" ? { createdAt: "asc" as const }
      : { createdAt: "desc" as const };

    const [total, summary, rows] = await Promise.all([
      prisma.contact.count({ where }),
      buildSummary(base),
      prisma.contact.findMany({
        where,
        select: leadSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Next follow-up, for THIS page's rows only. One grouped query rather
    // than a per-row lookup — 20 rows would otherwise be 20 round trips.
    const now = new Date();
    const pageIds = rows.map((r) => r.id);
    const nextFollowUps = pageIds.length
      ? await prisma.followUp.groupBy({
          by: ["contactId"],
          where: { contactId: { in: pageIds }, status: "PENDING", scheduledAt: { gte: now } },
          _min: { scheduledAt: true },
        })
      : [];
    const nextMap = new Map(nextFollowUps.map((f) => [f.contactId, f._min.scheduledAt]));

    const response: LeadsApiResponse = {
      success: true,
      message: total === 0 ? "No leads found" : "Leads fetched successfully",
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary,
      data: rows.map((r) => shapeLead(r, nextMap.get(r.id) ?? null, now)),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/leads]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

async function buildSummary(base: object): Promise<LeadSummary> {
  const [byStage, total, reEnquired] = await Promise.all([
    prisma.contact.groupBy({ by: ["leadStage"], where: base, _count: { id: true } }),
    prisma.contact.count({ where: base }),
    prisma.contact.count({ where: { ...base, reEnquiryCount: { gt: 0 } } }),
  ]);

  const count = new Map(byStage.map((r) => [r.leadStage, r._count.id]));

  return {
    total,
    fresh: count.get("FRESH") ?? 0,
    interested: count.get("INTERESTED") ?? 0,
    converted: count.get("CONVERTED") ?? 0,
    closed: count.get("CLOSED") ?? 0,
    irrelevant: count.get("IRRELEVANT") ?? 0,
    // 🚩 Not part of the same partition as the five stages — a re-enquired
    // lead still sits at one of them too. That's why these counts don't sum
    // to Total, exactly as the Follow-up page's "Rescheduled" pill doesn't.
    reEnquired,
  };
}

// ── POST /api/leads ──────────────────────────────────────────────────────────
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

    const body: CreateLeadPayload = await request.json();
    const prepared = await prepareLead(body, userId, userRole);
    if ("error" in prepared) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: prepared.error },
        { status: 400 }
      );
    }

    let created;
    try {
      // The lead and its first history entry are written together: a lead
      // whose timeline starts halfway through is worse than no lead at all,
      // and only a transaction rules that out.
      created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: prepared.data,
          select: leadSelect,
        });

        await tx.leadHistory.create({
          data: {
            contactId: contact.id,
            userId,
            type: "CREATED",
            toValue: `${prepared.statusLabel} · ${prepared.subStatusLabel}`,
            remark: body.remark?.trim() || null,
          },
        });

        return contact;
      });
    } catch (err: any) {
      // Contact.email is @unique — surfaced as a clean 400 rather than a 500,
      // the same way the Contacts route handles it.
      if (err?.code === "P2002") {
        return NextResponse.json<ApiError>(
          { error: "Bad Request", message: "A lead with this email already exists" },
          { status: 400 }
        );
      }
      throw err;
    }

    return NextResponse.json(
      {
        success: true,
        message: "Lead created successfully",
        data: shapeLead(created, null),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/leads]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to create lead" },
      { status: 500 }
    );
  }
}
