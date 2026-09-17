"use client";

// A row of pill buttons that pick one value, each with an optional count.
// Used for the status filters above the Leads and Follow-up tables.

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PillOption {
  label: string;
  value: string;
  count?: number;
}

interface FilterPillsProps {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the group for screen readers, e.g. "Filter by status". */
  label: string;
}

export default function FilterPills({ options, value, onChange, label }: FilterPillsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 gap-1.5 rounded-full px-3 text-xs font-medium",
              active
                ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                : "text-muted-foreground"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular-nums", active ? "text-background/70" : "text-faint")}>
                {o.count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
