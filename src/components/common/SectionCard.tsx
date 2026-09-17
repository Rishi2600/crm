"use client";

// A card with the reference design's header: a small medium-weight title, a
// one-line muted description, and optional controls on the right.

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Controls shown at the top right (filters, a sort, a button). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** For content that should run edge to edge, such as a table: "p-0". */
  contentClassName?: string;
}

export default function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-5">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-sm font-medium leading-5">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </CardHeader>
      <CardContent className={cn("p-5 pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
