"use client";

// A round avatar showing a person's initials. The CRM stores no profile
// pictures, so initials are all there is to show.

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** "Manish Kumar" → "MK"; "Manish" → "M"; "" → "?". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export default function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-7", className)}>
      <AvatarFallback className="bg-muted text-[11px] font-medium text-muted-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
