"use client";

// The signed-in sidebar: brand, navigation, and at the bottom a search entry
// and the user card. Collapses to icons, and becomes a sheet on mobile.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Moon, Search, Sun } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import { NAV_ITEMS, isActivePath } from "@/components/layout/nav";
import { useThemeToggle } from "@/components/layout/ThemeToggle";

interface StoredUser {
  name: string;
  email: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES_REP: "Sales Rep",
};

export default function AppSidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [shortcut, setShortcut] = useState("Ctrl K");
  const { dark, toggle, overlay } = useThemeToggle();
  const themeItemRef = useRef<HTMLDivElement>(null);

  // The user saved at login. Read after mount because localStorage doesn't
  // exist on the server.
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut("\u2318K");
    try {
      const raw = localStorage.getItem("crm-user");
      if (raw) setUser(JSON.parse(raw));
    } catch {
      setUser(null);
    }
  }, []);

  // FLAG: identical to the old sidebar's sign-out, on purpose — this refactor
  // doesn't change behaviour. The cookie line cannot actually clear the
  // httpOnly auth cookie (known problem §17 #3 in docs/PROJECT_CONTEXT.md).
  function handleLogout() {
    localStorage.removeItem("crm-token");
    localStorage.removeItem("crm-user");
    document.cookie = "auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    router.push("/login");
  }

  const name = user?.name ?? "Signed in";

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="pointer-events-none" tabIndex={-1}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  C
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">CRM</span>
                  <span className="truncate text-xs text-muted-foreground">Sales workspace</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActivePath(pathname, item.href)}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={`Search (${shortcut})`} onClick={onOpenSearch}>
                <Search aria-hidden />
                <span>Search</span>
                <kbd className="ml-auto rounded border px-1.5 font-mono text-[10px] text-muted-foreground">
                  {shortcut}
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={name}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <InitialsAvatar name={name} className="size-8" />
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? ""}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" aria-hidden />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg">
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid leading-tight">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</span>
                      {user?.role && (
                        <span className="mt-1 text-xs text-muted-foreground">
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem ref={themeItemRef} onSelect={() => toggle(themeItemRef.current)}>
                    {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
                    {dark ? "Light theme" : "Dark theme"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut aria-hidden />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {/* Outside the dropdown: the menu closes on click, the reveal
          animation must keep running. */}
      {overlay}
    </>
  );
}
