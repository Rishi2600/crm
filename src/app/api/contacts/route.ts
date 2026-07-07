// src/app/api/contacts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContactsApiResponse, ContactResponse } from "@/types/contacts";
import { ApiError } from "@/types/dashboard";

const LEAD_STATUS_LABEL: Record<string, string> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
};

export async function GET(request: NextRequest) {
  try {
    // ── Auth context — set by middleware after JWT verification ────────────
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    // ── Parse query params ──────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const sort = searchParams.get("sort") ?? "createdAt";

    if (!["name", "dealValue", "createdAt"].includes(sort)) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "Invalid sort field. Use: name, dealValue, or createdAt" },
        { status: 400 }
      );
    }

    // ── Authorization scope ──────────────────────────────────────────────────
    // ADMIN / MANAGER see all contacts. SALES_REP sees only contacts they own.
    const ownerFilter =
      userRole === "ADMIN" || userRole === "MANAGER" ? {} : { ownerId: userId };

    // ── Search filter — case-insensitive, partial match across 4 fields ────
    const searchFilter = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { company: { companyName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const where = { ...ownerFilter, ...searchFilter };

    // ── Fetch all matching contacts (with company joined) ───────────────────
    // Note: dealValue is computed (not a stored column), so we can't ORDER BY
    // it in SQL. We fetch matches, compute dealValue, sort in-memory, then
    // paginate. Fine at this table size; would need a materialized/cached
    // dealValue column if the contacts table grows into the hundreds of
    // thousands of rows.
    const allMatches = await prisma.contact.findMany({
      where,
      include: { company: { select: { companyName: true } } },
    });

    // ── Compute dealValue per contact (all non-LOST deals) ──────────────────
    const contactIds = allMatches.map((c) => c.id);

    const dealSums = contactIds.length
      ? await prisma.deal.groupBy({
          by: ["contactId"],
          where: { contactId: { in: contactIds }, status: { not: "LOST" } },
          _sum: { amount: true },
        })
      : [];

    const dealValueMap = new Map<string, number>();
    dealSums.forEach((d) => dealValueMap.set(d.contactId, Number(d._sum.amount ?? 0)));

    // ── Shape into ContactResponse + keep createdAt alongside for sorting ──
    // (createdAt isn't part of the public response shape, so we carry it in
    // a parallel tuple rather than polluting ContactResponse with an extra field.)
    const shapedWithDate: Array<{ contact: ContactResponse; createdAt: Date }> = allMatches.map((c) => ({
      contact: {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        company: c.company?.companyName ?? null,
        email: c.email,
        phone: c.phone,
        location: c.location,
        dealValue: dealValueMap.get(c.id) ?? 0,
        status: LEAD_STATUS_LABEL[c.leadStatus] ?? c.leadStatus,
        isFavourite: c.isFavourite,
      },
      createdAt: c.createdAt,
    }));

    // ── Sort ──────────────────────────────────────────────────────────────
    shapedWithDate.sort((a, b) => {
      if (sort === "name") return a.contact.name.localeCompare(b.contact.name);
      if (sort === "dealValue") return b.contact.dealValue - a.contact.dealValue;
      return b.createdAt.getTime() - a.createdAt.getTime(); // createdAt DESC (default)
    });

    const shaped: ContactResponse[] = shapedWithDate.map((s) => s.contact);

    // ── Paginate in-memory ──────────────────────────────────────────────────
    const total = shaped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pageData = shaped.slice(start, start + limit);

    // ── Empty state ──────────────────────────────────────────────────────────
    const response: ContactsApiResponse = {
      success: true,
      message: total === 0 ? "No contacts found" : "Contacts fetched successfully",
      page,
      limit,
      total,
      totalPages,
      data: pageData,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/contacts]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}