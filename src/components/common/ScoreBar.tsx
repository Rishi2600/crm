"use client";

// A 0–100 score as a short bar with the number beside it.

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress value={value} className="h-1.5 w-16" aria-label={`Score ${value} out of 100`} />
      <span className="w-9 text-xs tabular-nums text-foreground">{value}%</span>
    </div>
  );
}
