"use client";

// The "..." button at the end of a table row, opening that row's actions.
// Pass DropdownMenuItem elements as children.

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  /** Accessible name for the button, e.g. "Actions for Manish Kumar". */
  label: string;
  children: ReactNode;
}

export default function RowActionsMenu({ label, children }: RowActionsMenuProps) {
  return (
    // FLAG: non-modal on purpose. Most items open a dialog, and a modal menu
    // closing while a modal dialog opens can leave the page ignoring clicks
    // (pointer-events stuck on <body>).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={label}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
