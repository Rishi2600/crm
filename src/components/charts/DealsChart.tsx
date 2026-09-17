"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import SectionCard from "@/components/common/SectionCard";
import { GraphPoint } from "@/types/dashboard";

const config = {
  value: { label: "Deals", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

/** Deals created per month, with each month's count printed above its bar. */
export default function DealsChart({ data }: { data: GraphPoint[] }) {
  return (
    <SectionCard title="Deals" description="Created · last 6 months" className="h-full">
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          {/* minPointSize keeps an empty month visible as a stub, as the
              hand-drawn bars did. */}
          <Bar dataKey="value" fill="var(--color-value)" radius={4} minPointSize={2}>
            <LabelList
              dataKey="value"
              position="top"
              offset={6}
              fontSize={11}
              className="fill-muted-foreground tabular-nums"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </SectionCard>
  );
}
