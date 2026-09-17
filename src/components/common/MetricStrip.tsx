"use client";

// One card divided into equal cells by hairlines, each with a label, a large
// value and, where the data has one, a change line.
//
// Cells sit in a wrapping flex row rather than a grid. With `grow`, a
// half-empty last row stretches to fill the card, so there is never a blank
// grey cell, whatever the number of metrics. The dividers are each cell's own
// right and bottom borders; the -1px margins push the outermost ones under
// the card's edge, where overflow-hidden clips them.

import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MetricChange {
  /** Percentage change, e.g. 12.5 or -3. */
  percent: number;
  /** What it's measured against, e.g. "vs last month". */
  caption?: string;
  /** False where a rise is bad news (a cost, say). Colour means good or bad,
   *  never simply up or down. Defaults to true. */
  higherIsBetter?: boolean;
}

export interface Metric {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  change?: MetricChange;
}

// Full class strings, so Tailwind can see them. Two per row on phones and
// three on tablets, then the requested number from `lg` up.
const PER_ROW: Record<number, string> = {
  2: "lg:basis-1/2",
  3: "lg:basis-1/3",
  4: "lg:basis-1/4",
  5: "lg:basis-1/5",
  6: "lg:basis-1/6",
  7: "lg:basis-[14.2857%]",
  8: "lg:basis-1/4 xl:basis-[12.5%]",
};

interface MetricStripProps {
  metrics: Metric[];
  /** Cells per row on large screens. */
  perRow?: keyof typeof PER_ROW;
  loading?: boolean;
  /** Smaller values, for text such as dates and names rather than counts. */
  compact?: boolean;
  className?: string;
}

export default function MetricStrip({ metrics, perRow = 4, loading = false, compact = false, className }: MetricStripProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="-mb-px -mr-px flex flex-wrap">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={cn("min-w-0 grow basis-1/2 border-b border-r p-4 md:basis-1/3", PER_ROW[perRow])}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{m.label}</span>
              {m.icon && <m.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            </div>
            <div
              className={cn(
                "mt-2 font-semibold tabular-nums tracking-tight",
                compact ? "truncate text-base" : "text-2xl"
              )}
            >
              {loading ? <Skeleton className={cn("w-20", compact ? "h-6" : "h-8")} /> : m.value}
            </div>
            {m.change && !loading && <ChangeLine change={m.change} />}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChangeLine({ change }: { change: MetricChange }) {
  const { percent, caption, higherIsBetter = true } = change;
  const rising = percent >= 0;
  const good = higherIsBetter ? rising : !rising;
  const Arrow = rising ? TrendingUp : TrendingDown;

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
      <span className={cn("flex items-center gap-1 font-medium tabular-nums", good ? "text-success" : "text-danger")}>
        <Arrow className="size-3.5" aria-hidden />
        {rising ? "+" : "-"}
        {Math.abs(percent)}%
      </span>
      {caption && <span className="text-muted-foreground">{caption}</span>}
    </div>
  );
}
