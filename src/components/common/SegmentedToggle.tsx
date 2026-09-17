"use client";

// Two or three buttons that pick one value, drawn like the tab list. For a
// choice that changes how the same content is shown (a sort, say), where
// tabs would promise separate panels.

import { cn } from "@/lib/utils";

interface SegmentedToggleProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Rank by". */
  label: string;
  className?: string;
}

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedToggleProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-lg bg-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-border bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
