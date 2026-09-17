"use client";

// Two or more series side by side per category, with a legend. Colours come
// from the chart ramp in the order the series are given.

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const RAMP = ["hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--chart-5))"];

interface GroupedBarChartProps {
  data: object[];
  xKey: string;
  series: { key: string; label: string }[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

export default function GroupedBarChart({ data, xKey, series, height = 240, valueFormatter }: GroupedBarChartProps) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: RAMP[i % RAMP.length] }])
  );

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} tick={{ fontSize: 11 }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="dot"
              valueFormatter={valueFormatter ? (v) => valueFormatter(Number(v)) : undefined}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
