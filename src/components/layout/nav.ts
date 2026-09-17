// src/components/layout/nav.ts
// The signed-in navigation, in one place, so the sidebar and the command
// palette can never list different pages. Order and labels are unchanged
// from the original sidebar.

import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  LayoutDashboard,
  Layers,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: UserCheck },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Deals", href: "/deals", icon: Layers },
  { label: "Follow-up", href: "/follow-ups", icon: CalendarClock },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

/** Prefix match, not equality: a detail route like /leads/<id> keeps its
 *  section highlighted. The "/" guard stops /deals lighting up for a
 *  hypothetical /deals-archive. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
