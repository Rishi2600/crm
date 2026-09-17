"use client";

import SectionCard from "@/components/common/SectionCard";
import AreaTrendChart from "@/components/charts/AreaTrendChart";
import { GraphPoint } from "@/types/dashboard";
import { formatINR, formatINRExact } from "@/lib/currency";

export default function RevenueChart({ data }: { data: GraphPoint[] }) {
  return (
    <SectionCard title="Revenue" description="Won deals · last 6 months" className="h-full">
      <AreaTrendChart
        data={data}
        xKey="month"
        yKey="value"
        seriesLabel="Revenue"
        height={220}
        valueFormatter={formatINRExact}
        yTickFormatter={formatINR}
      />
    </SectionCard>
  );
}
