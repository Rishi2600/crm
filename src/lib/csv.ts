// src/lib/csv.ts
// A minimal RFC-4180 CSV reader, used by the Leads module's bulk upload.
//
// Written by hand rather than pulled in as a dependency: the app ships no
// parsing library today, and the one thing a naive `split(",")` cannot do is
// exactly the thing real exports need — a quoted field containing a comma
// ("Mumbai, MH") or a doubled quote. That's ~60 lines, so it's cheaper to own
// than to add a package for.
//
// Parsing happens on the SERVER. The browser could do it faster, but then the
// client would decide what counts as a valid row, and a hand-crafted request
// could bypass every check the upload route makes.

export interface CsvRow {
  /**
   * The 1-based PHYSICAL line the record starts on, so an error report can
   * say "row 7" and have the user find row 7 in their spreadsheet.
   *
   * 🚩 Tracked while scanning rather than derived from the row's index,
   * because the two drift apart the moment a file contains a blank line
   * (skipped, so every later index is short by one) or a quoted field with a
   * newline inside it (one record, several lines). Both are ordinary in real
   * exports, and an off-by-a-few row number sends someone hunting through the
   * wrong part of their file.
   */
  line: number;
  /** Cell values keyed by normalised header, trimmed, missing columns as "". */
  values: Record<string, string>;
}

export interface CsvParseResult {
  /** Header names, normalised so "First Name", "first_name" and "FIRSTNAME"
   *  all resolve — spreadsheets are inconsistent about both case and spacing. */
  headers: string[];
  rows: CsvRow[];
}

/** Normalises a header cell: "First Name" / "first_name" / " FIRSTNAME " → "firstname". */
export function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Splits CSV text into records, honouring quoted fields.
 *
 * Handles: quoted fields, "" as an escaped quote inside one, embedded commas
 * and newlines, CRLF and LF line endings, and a leading UTF-8 BOM (which Excel
 * writes and which would otherwise corrupt the very first header name).
 */
export function parseCsv(text: string): CsvParseResult {
  const clean = text.replace(/^﻿/, "");

  // Records as scanned, each with the physical line it began on.
  const records: { line: number; cells: string[] }[] = [];

  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let recordHasContent = false;

  const endRecord = () => {
    cells.push(field);
    records.push({ line: recordStartLine, cells });
    cells = [];
    field = "";
    recordHasContent = false;
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (!recordHasContent) {
      recordStartLine = line;
      recordHasContent = true;
    }

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        // A newline inside quotes belongs to the value, but still advances
        // the physical line the next record will be reported against.
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { cells.push(field); field = ""; continue; }
    if (ch === "\r") continue; // CRLF — the \n on the next pass ends the record
    if (ch === "\n") { endRecord(); line++; continue; }

    field += ch;
  }

  // Whatever is still buffered is the last record, unless the file ended with
  // a newline (in which case there is nothing left to flush).
  if (field !== "" || cells.length > 0) endRecord();

  // Drop blank records — a trailing newline, or a stray empty row in the
  // middle of a spreadsheet export, shouldn't be reported as an invalid lead.
  // Their line numbers are already recorded on the records that follow, so
  // dropping them here no longer shifts anything.
  const nonEmpty = records.filter((r) => r.cells.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].cells.map(normaliseHeader);

  const rows: CsvRow[] = nonEmpty.slice(1).map((record) => {
    const values: Record<string, string> = {};
    headers.forEach((h, idx) => { values[h] = (record.cells[idx] ?? "").trim(); });
    return { line: record.line, values };
  });

  return { headers, rows };
}
