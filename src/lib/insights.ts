// src/lib/insights.ts
// Shared helpers for the Dashboard insight routes (/api/insights/*).
//
// 🚩 The owner-scoping rule below is the SAME one inlined in Contacts, Deals,
// Tasks and Analytics — this is the fifth place it was needed, so it lives in
// one function here rather than being copy-pasted twice more. The four
// existing routes are deliberately left alone (changing them isn't part of
// this work), but if that rule ever changes, those four and this one have to
// move together.
//
// All bucketing is done in the SERVER's local timezone, matching the rest of
// the app (Deals/Analytics both format dates with local getters). A deploy in
// a different timezone than its users will shift day boundaries — a
// pre-existing, app-wide trait, not something introduced here.

import { prisma } from "@/lib/prisma";
import { TrendGranularity, TrendPoint } from "@/types/insights";

/** Widest series any single request may produce (a full year of daily buckets
 *  is 366, so this leaves headroom without letting a hand-typed range ask for
 *  tens of thousands of points). */
export const MAX_BUCKETS = 400;

// ─── Authorization scope ──────────────────────────────────────────────────────

/**
 * Resolves which owner IDs a user is allowed to see numbers for.
 * ADMIN → undefined (no filter, everyone). MANAGER → self + direct reports
 * (one level, same depth decided in the Tasks module). Everyone else → self.
 */
export async function resolveOwnerScope(
  userId: string,
  userRole: string | null
): Promise<string[] | undefined> {
  if (userRole === "ADMIN") return undefined;

  if (userRole === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    return [userId, ...reports.map((r) => r.id)];
  }

  return [userId];
}

/** Turns a scope into a Prisma `where` fragment (empty object = no filter). */
export function ownerWhere(ownerIds: string[] | undefined) {
  return ownerIds ? { ownerId: { in: ownerIds } } : {};
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parses a "YYYY-MM-DD" query param into a local Date.
 * `boundary: "end"` widens it to 23:59:59.999 so a `to` of today INCLUDES
 * everything created today — the classic off-by-one-day range bug.
 */
export function parseDateParam(
  value: string | null,
  boundary: "start" | "end"
): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (isNaN(parsed.getTime())) return undefined;
  return boundary === "end" ? endOfDay(parsed) : startOfDay(parsed);
}

/** Default window when the caller sends no range, sized to the granularity. */
export function defaultRange(granularity: TrendGranularity): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  const from = new Date();

  if (granularity === "daily") from.setDate(from.getDate() - 29);
  else if (granularity === "weekly") from.setDate(from.getDate() - 7 * 11);
  else from.setMonth(from.getMonth() - 5);

  return { from: startOfBucket(startOfDay(from), granularity), to };
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

/** Snaps a date down to the start of its bucket. Weeks start Monday. */
export function startOfBucket(d: Date, granularity: TrendGranularity): Date {
  if (granularity === "monthly") return new Date(d.getFullYear(), d.getMonth(), 1);

  if (granularity === "weekly") {
    const day = startOfDay(d);
    // getDay(): 0=Sun..6=Sat → shift so Monday is 0.
    const offset = (day.getDay() + 6) % 7;
    day.setDate(day.getDate() - offset);
    return day;
  }

  return startOfDay(d);
}

/** Advances a bucket-start date to the next bucket. */
function nextBucket(d: Date, granularity: TrendGranularity): Date {
  const next = new Date(d);
  if (granularity === "monthly") next.setMonth(next.getMonth() + 1);
  else if (granularity === "weekly") next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  return next;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatBucketLabel(d: Date, granularity: TrendGranularity): string {
  if (granularity === "monthly") return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  if (granularity === "weekly") return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]}`;
  // Daily — dd/mm/yyyy, the format the trend tooltip uses.
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** How many buckets a range would produce — used to reject absurd requests
 *  BEFORE running the query. */
export function countBuckets(from: Date, to: Date, granularity: TrendGranularity): number {
  let cursor = startOfBucket(from, granularity);
  const last = startOfBucket(to, granularity);
  let n = 0;
  while (cursor.getTime() <= last.getTime() && n <= MAX_BUCKETS) {
    n++;
    cursor = nextBucket(cursor, granularity);
  }
  return n;
}

/**
 * Buckets timestamps into a CONTINUOUS, zero-filled series across the range.
 * Zero-filling matters: without it a quiet week vanishes from the x-axis
 * entirely and the chart silently compresses time.
 */
export function bucketByDate(
  dates: Date[],
  from: Date,
  to: Date,
  granularity: TrendGranularity
): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();

  let cursor = startOfBucket(from, granularity);
  const last = startOfBucket(to, granularity);
  while (cursor.getTime() <= last.getTime()) {
    buckets.set(toISODate(cursor), {
      date: toISODate(cursor),
      label: formatBucketLabel(cursor, granularity),
      value: 0,
    });
    cursor = nextBucket(cursor, granularity);
  }

  for (const d of dates) {
    const key = toISODate(startOfBucket(d, granularity));
    const bucket = buckets.get(key);
    // Rows outside the range can't occur (the query filters on it), but a row
    // exactly on a boundary could land one bucket out — skip rather than throw.
    if (bucket) bucket.value += 1;
  }

  return Array.from(buckets.values());
}
