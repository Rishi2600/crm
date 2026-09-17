"use client";

import Select from "@/components/common/Select";
import SectionCard from "@/components/common/SectionCard";
import ErrorBanner from "@/components/common/ErrorBanner";
import AreaTrendChart from "@/components/charts/AreaTrendChart";
import { cn } from "@/lib/utils";
import { TrendGranularity, TrendMetric, TrendPoint } from "@/types/insights";

const METRIC_OPTIONS: { label: string; value: TrendMetric }[] = [
  { label: "Leads", value: "leads" },
  { label: "Follow-Ups", value: "followUps" },
  { label: "Deals", value: "deals" },
];

const GRANULARITY_OPTIONS: { label: string; value: TrendGranularity }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const METRIC_AXIS_LABEL: Record<TrendMetric, string> = {
  leads: "No. of Leads",
  followUps: "No. of Follow-Ups",
  deals: "No. of Deals",
};

interface TrendsChartProps {
  points: TrendPoint[];
  metric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
  granularity: TrendGranularity;
  onGranularityChange: (granularity: TrendGranularity) => void;
  loading?: boolean;
  error?: string;
}

export default function TrendsChart({
  points,
  metric,
  onMetricChange,
  granularity,
  onGranularityChange,
  loading = false,
  error = "",
}: TrendsChartProps) {
  // A long daily range produces far more buckets than there is room for
  // labels, so thin them out to roughly a dozen rather than letting recharts
  // overlap them into an unreadable smear.
  const tickInterval = Math.max(0, Math.ceil(points.length / 12) - 1);

  const hasData = points.some((p) => p.value > 0);
  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? "";

  return (
    <SectionCard
      title="Trends"
      description={`${metricLabel} over time`}
      action={
        <>
          <Select
            value={metric}
            onChange={(v) => onMetricChange(v as TrendMetric)}
            options={METRIC_OPTIONS}
            className="w-36"
            align="right"
          />
          <Select
            value={granularity}
            onChange={(v) => onGranularityChange(v as TrendGranularity)}
            options={GRANULARITY_OPTIONS}
            className="w-32"
            align="right"
          />
        </>
      }
    >
      {error && <ErrorBanner className="my-12 text-center">{error}</ErrorBanner>}

      {!error && (
        <div className={cn("transition-opacity duration-150", loading && "opacity-40")}>
          {/* An all-zero series still renders — an empty stretch of calendar is
              a real answer, and blanking the chart would hide the axis that
              says which stretch it was. */}
          {!hasData && !loading && (
            <p className="mb-2 text-xs text-muted-foreground">No activity in this period</p>
          )}

          <AreaTrendChart
            data={points}
            xKey="label"
            yKey="value"
            seriesLabel={metricLabel}
            height={280}
            xInterval={tickInterval}
            allowDecimals={false}
            yAxisLabel={METRIC_AXIS_LABEL[metric]}
          />
        </div>
      )}
    </SectionCard>
  );
}
