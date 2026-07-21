// src/app/api/companies/route.ts
// Minimal — just enough to populate the "Company" dropdown on the Contact
// creation form. Not a full Companies module (no search/pagination/CRUD);
// flagging that if Companies ever needs its own management page, this
// would need to grow into a proper module the same way Contacts/Deals did.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/types/dashboard";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: "Unauthorized", message: "Missing user context" },
        { status: 401 }
      );
    }

    const companies = await prisma.company.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    });

    return NextResponse.json({ success: true, data: companies }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/companies]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}