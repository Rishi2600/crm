// src/lib/leads.server.ts
// The database-touching half of the Leads module's shared logic.
//
// Split from @/lib/leads purely so that file can stay importable by the
// client: the Leads pages build their Status/Sub-Status dropdowns from the
// same maps the API validates against, and anything those maps' module
// imports ends up in the browser bundle. Everything here runs on the server
// only — the ".server" suffix is the reminder.

import { prisma } from "@/lib/prisma";
import {
  LABEL_TO_STATUS,
  LABEL_TO_SUB_STATUS,
  LABEL_TO_SOURCE,
  LABEL_TO_TEMPERATURE,
  SUB_STATUS_BY_STATUS,
  defaultSubStatusFor,
  isValidPair,
  parseLeadScore,
} from "@/lib/leads";
import { CreateLeadPayload, LeadStatusLabel, LeadSubStatusLabel } from "@/types/leads";

// ─── Create-payload preparation ───────────────────────────────────────────────

/**
 * Validates a create payload and resolves everything that needs a DB lookup
 * (company find-or-create, owner authorization).
 *
 * Exported because the CSV bulk upload validates each of its rows through
 * exactly this function — a lead added by file has to be as valid as one added
 * by hand, and two copies of these rules would drift apart within a release.
 */
export async function prepareLead(
  body: CreateLeadPayload,
  userId: string,
  userRole: string | null
): Promise<
  | { error: string }
  | { data: any; statusLabel: LeadStatusLabel; subStatusLabel: LeadSubStatusLabel }
> {
  if (!body.firstName?.trim()) return { error: "First name is mandatory" };
  if (!body.lastName?.trim()) return { error: "Last name is mandatory" };
  if (!body.email?.trim()) return { error: "Email is mandatory" };

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Invalid email address" };

  const statusLabel = (body.status ?? "Fresh") as LeadStatusLabel;
  if (!LABEL_TO_STATUS[statusLabel]) return { error: `Invalid status "${body.status}"` };

  const subStatusLabel = (body.subStatus ?? defaultSubStatusFor(statusLabel)) as LeadSubStatusLabel;
  if (!LABEL_TO_SUB_STATUS[subStatusLabel]) return { error: `Invalid sub-status "${body.subStatus}"` };
  if (!isValidPair(statusLabel, subStatusLabel)) {
    return {
      error: `"${subStatusLabel}" is not a sub-status of "${statusLabel}". Valid: ${SUB_STATUS_BY_STATUS[statusLabel].join(", ")}`,
    };
  }

  const temperatureLabel = body.temperature ?? "Warm";
  const temperatureEnum = LABEL_TO_TEMPERATURE[temperatureLabel];
  if (!temperatureEnum) return { error: `Invalid temperature "${body.temperature}"` };

  const sourceLabel = body.source ?? "Direct";
  const sourceEnum = LABEL_TO_SOURCE[sourceLabel];
  if (!sourceEnum) return { error: `Invalid source "${body.source}"` };

  const leadScore = parseLeadScore(body.leadScore) ?? 0;

  // Company: find-or-create by name, so the form stays a plain text input
  // instead of a dropdown needing its own round trip — same call the Contacts
  // create route makes.
  let companyId: string | null = null;
  if (body.companyName?.trim()) {
    const name = body.companyName.trim();
    const existing = await prisma.company.findFirst({
      where: { companyName: { equals: name, mode: "insensitive" } },
    });
    companyId = existing ? existing.id : (await prisma.company.create({ data: { companyName: name } })).id;
  }

  // 🚩 Owner assignment — the hierarchy rule shared with Contacts, Deals,
  // Tasks and Follow-ups. Self always allowed, ADMIN can assign to anyone,
  // otherwise the owner must be a direct report. Without it an agent could
  // plant leads in someone else's queue by passing their ID.
  const ownerId = body.ownerId || userId;
  if (ownerId !== userId && userRole !== "ADMIN") {
    const isDirectReport = await prisma.user.findFirst({ where: { id: ownerId, managerId: userId } });
    if (!isDirectReport) return { error: "Invalid agent" };
  }

  return {
    statusLabel,
    subStatusLabel,
    data: {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email,
      phone: body.phone?.trim() || null,
      companyId,
      location: body.location?.trim() || null,
      leadStage: LABEL_TO_STATUS[statusLabel] as any,
      leadSubStatus: LABEL_TO_SUB_STATUS[subStatusLabel] as any,
      leadStatus: temperatureEnum as any,
      leadSource: sourceEnum as any,
      sourceName: body.sourceName?.trim() || null,
      leadScore,
      ownerId,
    },
  };
}
