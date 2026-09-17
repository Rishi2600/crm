// src/app/(app)/layout.tsx
// Shared frame for every signed-in page. Being a layout rather than a
// component each page renders, the sidebar is mounted once and survives
// navigation, so its collapsed state and the command palette don't reset.
//
// Authentication is unchanged: middleware guards these routes, and each page
// still redirects to /login when no token is stored.

import { cookies } from "next/headers";
import AppShell from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The shadcn sidebar stores its open/collapsed state in this cookie.
  // Reading it on the server renders the right state first time instead of
  // flashing open and then collapsing. It has nothing to do with auth.
  const defaultOpen = cookies().get("sidebar_state")?.value !== "false";
  return <AppShell defaultOpen={defaultOpen}>{children}</AppShell>;
}
