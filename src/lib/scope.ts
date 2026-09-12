// src/lib/scope.ts
// Authorization scope + date-param parsing, shared by the Insights and
// Follow-up routes.
//
// 🚩 The owner-scoping rule below is the SAME one inlined in Contacts, Deals,
// Tasks and Analytics. Rather than paste it into every new route, new work
// calls this. The four original routes are deliberately left untouched
// (rewriting them isn't part of this work) — but if the rule ever changes,
// those four and this one have to move together.
//
// Dates are handled in the SERVER's local timezone, matching the rest of the
// app (Deals and Analytics both format with local getters). A deploy in a
// different timezone from its users shifts day boundaries — an app-wide
// trait, not something introduced here.

import { prisma } from "@/lib/prisma";

// ─── Authorization scope ──────────────────────────────────────────────────────

/**
 * Resolves which owner IDs a user may see rows for.
 * ADMIN → undefined (no filter, everyone). MANAGER → self + direct reports
 * (one level, the depth decided in the Tasks module). Everyone else → self.
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

/** True when `candidate` is inside the caller's scope (undefined = all). */
export function isInScope(ownerIds: string[] | undefined, candidate: string): boolean {
  return ownerIds === undefined || ownerIds.includes(candidate);
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
 * everything on today — the classic off-by-one-day range bug.
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

/**
 * Combines a "YYYY-MM-DD" date with an optional "HH:mm" time into a local
 * Date. Returns undefined when the date is missing or unparseable, so callers
 * can turn that into a 400 rather than silently storing an Invalid Date.
 */
export function parseDateTime(date: string, time?: string): Date | undefined {
  if (!date) return undefined;
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  const parsed = new Date(`${date}T${t}:00`);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
