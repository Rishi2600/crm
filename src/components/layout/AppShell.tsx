"use client";

// The signed-in frame: sidebar on the page background, and beside it a
// rounded, bordered content panel whose top bar holds the sidebar toggle,
// the page's own title and controls, and the search button.

import { useState } from "react";
import { Search } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import AppSidebar from "@/components/layout/AppSidebar";
import CommandMenu from "@/components/layout/CommandMenu";
import { PageHeaderProvider, PageHeaderSlots } from "@/components/layout/PageHeader";

export default function AppShell({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <PageHeaderProvider>
        <AppSidebar onOpenSearch={() => setSearchOpen(true)} />
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <PageHeaderSlots />
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Search pages"
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden />
            </Button>
          </header>
          <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
      </PageHeaderProvider>
    </SidebarProvider>
  );
}
