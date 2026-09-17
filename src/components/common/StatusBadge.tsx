"use client";

// A status shown as an outlined badge with a coloured dot. The dot carries
// the colour so the text stays readable in both themes.

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FALLBACK_STATUS_COLOR } from "@/components/common/statusColors";

interface StatusBadgeProps {
  /** A CSS colour, usually from one of the maps in statusColors.ts. */
  color?: string;
  children: ReactNode;
  className?: string;
}

export default function StatusBadge({ color, children, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap px-2 font-medium text-foreground", className)}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: color ?? FALLBACK_STATUS_COLOR }}
        aria-hidden
      />
      {children}
    </Badge>
  );
}
