"use client";

// Generic loading placeholders. The public API is unchanged: `LoadingState`
// with `label`, `size` and `variant`, plus the `Spinner` export.
//
// Pages replace these with skeletons shaped like their final content as
// they are converted; this is the fallback for anything not yet converted.

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: number;
  className?: string;
}

// A single rotating ring, coloured from the theme tokens.
export function Spinner({ size = 18, className = "" }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-spin", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" className="stroke-border" strokeWidth="2.5" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        className="stroke-foreground"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LoadingStateProps {
  label?: string;
  /** Kept for API compatibility; the skeleton layout doesn't use it. */
  size?: number;
  /** "block" for a full-section placeholder, "inline" for a compact
   *  one (e.g. inside a table body or a small card). */
  variant?: "block" | "inline";
}

// Using ONE component everywhere means every loading state in the app looks
// and feels identical, regardless of whether that particular fetch resolves
// in 50ms or 2s — no more pages where a plain "Loading..." string abruptly
// swaps to "No data found", which is what made moderate-latency loads feel
// broken rather than slow.
export default function LoadingState({ label, variant = "block" }: LoadingStateProps) {
  // Screen readers get a status message; sighted users get the shapes.
  const status = label ?? "Loading";

  if (variant === "inline") {
    return (
      <div role="status" aria-live="polite" className="space-y-2 px-4 py-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        {label ? (
          <p className="pt-1 text-xs text-muted-foreground">{label}</p>
        ) : (
          <span className="sr-only">{status}</span>
        )}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="space-y-4 py-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-56" />
      {label ? (
        <p className="text-center text-xs text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">{status}</span>
      )}
    </div>
  );
}
