// src/app/api/deals/route.ts
// Separate from /deals/pipeline deliberately — pipeline is shaped
// specifically for the Kanban board (flat array + stage summary); creating
// a deal is a general-purpose write, same split Tasks already has between
// /api/tasks (list+create) and nothing pipeline-shaped needed there.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateDealPayload, CreateDealResponse, DealCardResponse } from "@/types/deals";
import { ApiError } from "@/types/dashboard";

const STAGE_LABEL: Record<string, string> = {
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
};

const LABEL_TO_STAGE: Record<string, string> = {
  Qualification: "QUALIFICATION",
  Proposal: "PROPOSAL",
  Negotiation: "NEGOTIATION",
  "Closed Won": "CLOSED_WON",
};

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

    const body: CreateDealPayload = await request.json();

    // ── Mandatory field validation ──────────────────────────────────────────
    if (!body.title?.trim()) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Title is mandatory" }, { status: 400 });
    }
    if (!body.contactId) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Contact is mandatory" }, { status: 400 });
    }
    if (body.amount === undefined || body.amount === null || isNaN(Number(body.amount))) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Amount is mandatory and must be a number" }, { status: 400 });
    }
    if (Number(body.amount) < 0) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Amount cannot be negative" }, { status: 400 });
    }

    // ── Contact must exist ───────────────────────────────────────────────────
    const contact = await prisma.contact.findUnique({ where: { id: body.contactId } });
    if (!contact) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Invalid contact" }, { status: 400 });
    }

    // ── Stage validation ──────────────────────────────────────────────────────
    const stageEnum = body.stage ? LABEL_TO_STAGE[body.stage] : "QUALIFICATION";
    if (!stageEnum) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Invalid stage" }, { status: 400 });
    }

    // 🚩 Probability range validation — this closes a gap flagged back in
    // the Deals Pipeline chunk: the `probability` column existed in the
    // schema from day one, but nothing ever enforced its 0–100 range
    // because no create/edit-deal endpoint existed yet. This is that
    // endpoint, so the validation the story originally asked for lands here.
    const probability = body.probability ?? 0;
    if (probability < 0 || probability > 100) {
      return NextResponse.json<ApiError>({ error: "Bad Request", message: "Probability must be between 0 and 100" }, { status: 400 });
    }

    // 🚩 Owner assignment — same hierarchy-scoped pattern reused from Tasks
    // and Contacts. Self always allowed; ADMIN can assign to anyone;
    // otherwise must be a direct report.
    const ownerId = body.ownerId ?? userId;
    const isSelf = ownerId === userId;
    const isAdmin = userRole === "ADMIN";
    if (!isSelf && !isAdmin) {
      const isDirectReport = await prisma.user.findFirst({ where: { id: ownerId, managerId: userId } });
      if (!isDirectReport) {
        return NextResponse.json<ApiError>({ error: "Bad Request", message: "Invalid owner" }, { status: 400 });
      }
    }

    const created = await prisma.deal.create({
      data: {
        title: body.title.trim(),
        contactId: body.contactId,
        ownerId,
        amount: Number(body.amount),
        stage: stageEnum as any,
        probability,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      },
      select: {
        id: true, title: true, amount: true, stage: true, probability: true, expectedCloseDate: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    const data: DealCardResponse = {
      id: created.id,
      title: created.title,
      amount: Number(created.amount),
      contactName: `${created.contact.firstName} ${created.contact.lastName}`,
      expectedCloseDate: created.expectedCloseDate ? created.expectedCloseDate.toISOString().split("T")[0] : null,
      probability: created.probability,
      stage: STAGE_LABEL[created.stage] ?? created.stage,
    };

    const response: CreateDealResponse = {
      success: true,
      message: "Deal created successfully",
      data,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deals]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to create deal" },
      { status: 500 }
    );
  }
}