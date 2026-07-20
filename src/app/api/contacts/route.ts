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
    // Multi-word searches ("John Smith") need special handling — firstName
    // and lastName are separate columns, so a plain OR-per-column check
    // fails once the search string spans both (neither column alone
    // contains the full two-word string). Splitting on the first space and
    // matching each half to its own column fixes "First Last" search while
    // leaving single-word / email / company search behavior unchanged.
    const searchTokens = search.split(/\s+/).filter(Boolean);
    const fullNameFilter =
      searchTokens.length >= 2
        ? [{
            AND: [
              { firstName: { contains: searchTokens[0], mode: "insensitive" as const } },
              { lastName: { contains: searchTokens.slice(1).join(" "), mode: "insensitive" as const } },
            ],
          }]
        : [];

    const searchFilter = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { company: { is: { companyName: { contains: search, mode: "insensitive" as const } } } },
            ...fullNameFilter,
          ],
        }
      : {};

    const where = { ...ownerFilter, ...searchFilter };

    // ── Total count — needed for pagination metadata regardless of sort ────
    const total = await prisma.contact.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Fields we actually need on the response — avoids over-fetching
    // (e.g. password, updatedAt, raw enum values never used in ContactResponse)
    const contactSelect = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      location: true,
      leadStatus: true,
      isFavourite: true,
      createdAt: true,
      company: { select: { companyName: true } },
    } as const;

    let pageContactsRaw: Array<{
      id: string; firstName: string; lastName: string; email: string;
      phone: string | null; location: string | null; leadStatus: string;
      isFavourite: boolean; createdAt: Date; company: { companyName: string } | null;
    }>;
    let dealValueMap = new Map<string, number>();

    if (sort === "dealValue") {
      // ── dealValue is computed, not a stored column — can't ORDER BY it in
      // SQL. We still have to pull every matching row to sort correctly,
      // then slice the page out in memory. This branch stays O(total matches)
      // regardless of page size; the name/createdAt branch below is the
      // actual fix for the common case.
      const allMatches = await prisma.contact.findMany({ where, select: contactSelect });

      const contactIds = allMatches.map((c) => c.id);
      const dealSums = contactIds.length
        ? await prisma.deal.groupBy({
            by: ["contactId"],
            where: { contactId: { in: contactIds }, status: { not: "LOST" } },
            _sum: { amount: true },
          })
        : [];
      dealSums.forEach((d) => dealValueMap.set(d.contactId, Number(d._sum.amount ?? 0)));

      allMatches.sort((a, b) => (dealValueMap.get(b.id) ?? 0) - (dealValueMap.get(a.id) ?? 0));

      const start = (page - 1) * limit;
      pageContactsRaw = allMatches.slice(start, start + limit);
    } else {
      // ── DB-level pagination — the actual fix. Only ever pulls `limit` rows
      // from Postgres, with sorting and offsetting done by the database
      // itself instead of fetching everything and slicing in JS.
      pageContactsRaw = await prisma.contact.findMany({
        where,
        select: contactSelect,
        orderBy: sort === "name" ? { firstName: "asc" } : { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });

      // dealValue only computed for THIS page's rows, not the whole table
      const pageIds = pageContactsRaw.map((c) => c.id);
      const dealSums = pageIds.length
        ? await prisma.deal.groupBy({
            by: ["contactId"],
            where: { contactId: { in: pageIds }, status: { not: "LOST" } },
            _sum: { amount: true },
          })
        : [];
      dealSums.forEach((d) => dealValueMap.set(d.contactId, Number(d._sum.amount ?? 0)));
    }

    // ── Shape into ContactResponse ────────────────────────────────────────
    const pageData: ContactResponse[] = pageContactsRaw.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      company: c.company?.companyName ?? null,
      email: c.email,
      phone: c.phone,
      location: c.location,
      dealValue: dealValueMap.get(c.id) ?? 0,
      status: LEAD_STATUS_LABEL[c.leadStatus] ?? c.leadStatus,
      isFavourite: c.isFavourite,
    }));

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