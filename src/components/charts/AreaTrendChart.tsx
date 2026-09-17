"use client";

// The app's one area chart: a line with a gradient fill fading to nothing,
// coloured from the chart ramp. Revenue, Trends and Analytics all use it so
// they read as one family.

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface AreaTrendChartProps {
  /** Rows of any shape; `xKey` and `yKey` name the fields to plot. */
  data: object[];
  xKey: string;
  yKey: string;
  /** Series name shown in the tooltip. */
  seriesLabel: string;
  height?: number;
  /** Formats tooltip values (e.g. formatINRExact for money). */
  valueFormatter?: (value: number) => string;
  /** Formats Y-axis ticks (e.g. formatINR for money). */
  yTickFormatter?: (value: number) => string;
  /** Show every Nth X label; long daily ranges need thinning. */
  xInterval?: number;
  allowDecimals?: boolean;
  yAxisLabel?: string;
}

export default function AreaTrendChart({
  data,
  xKey,
  yKey,
  seriesLabel,
  height = 240,
  valueFormatter,
  yTickFormatter,
  xInterval = 0,
  allowDecimals = true,
  yAxisLabel,
}: AreaTrendChartProps) {
  // SVG gradients are referenced by id, and a page can show several of these
  // charts, so each needs its own. useId's colons aren't safe inside url().
  const gradientId = `area-fill-${useId().replace(/:/g, "")}`;
  const config: ChartConfig = { [yKey]: { label: seriesLabel, color: "hsl(var(--chart-1))" } };
  const colour = `var(--color-${yKey})`;

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colour} stopOpacity={0.35} />
            <stop offset="95%" stopColor={colour} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={xInterval}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          allowDecimals={allowDecimals}
          tickFormatter={yTickFormatter}
          tick={{ fontSize: 11 }}
          label={
            yAxisLabel
              ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, textAnchor: "middle", fill: "hsl(var(--chart-axis))" },
                }
              : undefined
          }
        />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--ui-border))" }}
          content={
            <ChartTooltipContent
              indicator="line"
              valueFormatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <Area
          dataKey={yKey}
          type="monotone"
          fill={`url(#${gradientId})`}
          stroke={colour}
          strokeWidth={2}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
