// src/app/api/leads/bulk/route.ts
//
// GET  /api/leads/bulk — downloads the blank CSV template.
// POST /api/leads/bulk — imports a filled-in one.
//
// The template is served rather than hard-coded in the page so the column list
// has exactly one owner: if a column is added here, the file the user downloads
// and the parser that reads it back change together.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { prepareLead } from "@/lib/leads.server";
import { BulkUploadResponse, BulkUploadRowError, CreateLeadPayload } from "@/types/leads";
import { ApiError } from "@/types/dashboard";

export const dynamic = "force-dynamic";

/** Template header → the CreateLeadPayload field it fills. Keys are already
 *  normalised the way lib/csv normalises what it reads, so "First Name",
 *  "first_name" and "FIRSTNAME" all land on the same field. */
const COLUMNS: { header: string; key: keyof CreateLeadPayload; example: string }[] = [
  { header: "First Name",  key: "firstName",   example: "Manish" },
  { header: "Last Name",   key: "lastName",    example: "Kumar" },
  { header: "Email",       key: "email",       example: "manish.kumar@example.com" },
  { header: "Phone",       key: "phone",       example: "+91-9876543210" },
  { header: "Company",     key: "companyName", example: "Acme Pvt Ltd" },
  { header: "Location",    key: "location",    example: "Aurangabad" },
  { header: "Status",      key: "status",      example: "Fresh" },
  { header: "Sub-Status",  key: "subStatus",   example: "Untouched" },
  { header: "Temperature", key: "temperature", example: "Warm" },
  { header: "Source",      key: "source",      example: "Campaign" },
  { header: "Source Name", key: "sourceName",  example: "The Tribune" },
  { header: "Lead Score",  key: "leadScore",   example: "9" },
];

/** Hard ceiling per upload. A 50k-row paste would hold a serverless request
 *  open long past its timeout and half-import the file; a clear "split it up"
 *  error is better than a mystery 504 with an unknown number of rows written. */
const MAX_ROWS = 500;

// ── GET /api/leads/bulk — blank template ─────────────────────────────────────
export async function GET() {
  const header = COLUMNS.map((c) => c.header).join(",");
  const example = COLUMNS.map((c) => c.example).join(",");

  return new NextResponse(`${header}\n${example}\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lead-upload-template.csv"',
    },
  });
}

// ── POST /api/leads/bulk — import ────────────────────────────────────────────
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

    const body: { csv?: string } = await request.json();
    const csv = body.csv ?? "";

    if (!csv.trim()) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "The file is empty" },
        { status: 400 }
      );
    }

    const { headers, rows } = parseCsv(csv);

    if (rows.length === 0) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: "The file has a header row but no leads in it" },
        { status: 400 }
      );
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json<ApiError>(
        { error: "Bad Request", message: `Too many rows (${rows.length}). Please upload at most ${MAX_ROWS} leads per file.` },
        { status: 400 }
      );
    }

    // Reject a file that isn't the template before touching a single row —
    // "Email is mandatory" repeated 400 times is a far worse explanation of
    // "you uploaded the wrong file" than saying so once.
    const required = ["firstname", "lastname", "email"];
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length > 0) {
      return NextResponse.json<ApiError>(
        {
          error: "Bad Request",
          message: `The file is missing required column(s): ${missing.join(", ")}. Download the template to see the expected format.`,
        },
        { status: 400 }
      );
    }

    // Emails already in the DB, fetched in ONE query. Checking per row would
    // be a round trip each; this is a single `IN (...)`.
    const fileEmails = rows.map((r) => (r.values.email ?? "").trim().toLowerCase()).filter(Boolean);
    const existing = await prisma.contact.findMany({
      where: { email: { in: fileEmails } },
      select: { email: true },
    });
    const takenEmails = new Set(existing.map((e) => e.email));

    // Duplicates WITHIN the file matter just as much — the first row wins and
    // the rest are reported, rather than the whole upload failing on a
    // uniqueness violation halfway through.
    const seenInFile = new Set<string>();

    const errors: BulkUploadRowError[] = [];
    let created = 0;

    for (const { line: rowNumber, values: row } of rows) {
      // The row's own physical line, straight from the parser — see the note
      // on CsvRow.line for why this isn't just the loop index.
      const displayName = [row.firstname, row.lastname].filter(Boolean).join(" ") || row.email || "(blank row)";

      const email = (row.email ?? "").trim().toLowerCase();

      if (email && takenEmails.has(email)) {
        errors.push({ row: rowNumber, name: displayName, reason: "A lead with this email already exists" });
        continue;
      }
      if (email && seenInFile.has(email)) {
        errors.push({ row: rowNumber, name: displayName, reason: "Duplicate email earlier in this file" });
        continue;
      }

      // Built from the same COLUMNS map the template is, so a column can't be
      // in the downloaded file but silently ignored on the way back in.
      const payload: CreateLeadPayload = { firstName: "", lastName: "", email: "" };
      for (const col of COLUMNS) {
        const value = row[col.header.trim().toLowerCase().replace(/[\s_-]+/g, "")];
        if (value) (payload as any)[col.key] = value;
      }

      // 🚩 Every row goes through the SAME prepareLead the Add Lead form uses.
      // A lead that arrives by file is held to exactly the checks a hand-typed
      // one is — including the stage/sub-status pairing and the owner
      // hierarchy rule — because two copies of that validation would drift.
      const prepared = await prepareLead(payload, userId, userRole);
      if ("error" in prepared) {
        errors.push({ row: rowNumber, name: displayName, reason: prepared.error });
        continue;
      }

      try {
        // Per-row transaction, not one for the whole file: the lead and its
        // opening history entry must land together, but one malformed row at
        // line 400 must not discard the 399 good ones before it. The response
        // reports exactly which rows were skipped and why.
        await prisma.$transaction(async (tx) => {
          const contact = await tx.contact.create({ data: prepared.data, select: { id: true } });
          await tx.leadHistory.create({
            data: {
              contactId: contact.id,
              userId,
              type: "CREATED",
              toValue: `${prepared.statusLabel} · ${prepared.subStatusLabel}`,
              remark: "Imported from CSV",
            },
          });
        });

        if (email) seenInFile.add(email);
        created++;
      } catch (err: any) {
        // A concurrent upload can still win the race on an email between the
        // bulk pre-check above and this insert — caught per row so it costs
        // one line of the report, not the whole import.
        const reason =
          err?.code === "P2002"
            ? "A lead with this email already exists"
            : "Could not be saved";
        errors.push({ row: rowNumber, name: displayName, reason });
      }
    }

    const response: BulkUploadResponse = {
      success: created > 0,
      message:
        created === 0
          ? "No leads were imported"
          : `Imported ${created} lead${created === 1 ? "" : "s"}${errors.length ? `, skipped ${errors.length}` : ""}`,
      created,
      failed: errors.length,
      errors,
    };

    // 200 even with skipped rows — the request itself succeeded and the body
    // is the report. A 4xx here would make the client treat a mostly-good
    // import as a total failure and throw the report away.
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[POST /api/leads/bulk]", error);
    return NextResponse.json<ApiError>(
      { error: "Internal Server Error", message: "Failed to import leads" },
      { status: 500 }
    );
  }
}
