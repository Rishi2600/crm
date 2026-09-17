"use client";

// The strip under a paged table: where you are, the total, and buttons for
// the first, previous, next and last page. Page sizes are fixed per page.

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function PaginationFooter({ page, totalPages, total, onPageChange, className }: PaginationFooterProps) {
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  const buttons = [
    { label: "First page", icon: ChevronsLeft, target: 1, disabled: atStart },
    { label: "Previous page", icon: ChevronLeft, target: Math.max(1, page - 1), disabled: atStart },
    { label: "Next page", icon: ChevronRight, target: Math.min(totalPages, page + 1), disabled: atEnd },
    { label: "Last page", icon: ChevronsRight, target: totalPages, disabled: atEnd },
  ];

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3", className)}>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · Count: {total}
      </span>
      <div className="flex items-center gap-1.5">
        {buttons.map(({ label, icon: Icon, target, disabled }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(target)}
            disabled={disabled}
            aria-label={label}
            title={label}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
    </div>
  );
}
