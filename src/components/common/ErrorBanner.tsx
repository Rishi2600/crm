"use client";

// The one way a page shows a failed load or a failed action inline.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-danger",
        className
      )}
    >
      {children}
    </div>
  );
}
