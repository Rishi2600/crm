"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Select from "@/components/ui/Select";
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

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
    >
      <div style={{ color: "var(--text-muted)" }} className="mb-0.5">{label}</div>
      <div className="font-semibold tabular-nums">{payload[0].value.toLocaleString()}</div>
    </div>
  );
}

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

  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Trends</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {METRIC_OPTIONS.find((m) => m.value === metric)?.label} over time
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {error && (
        <div className="py-16 text-center text-xs" style={{ color: "var(--red)" }}>{error}</div>
      )}

      {!error && (
        <div style={{ opacity: loading ? 0.4 : 1, transition: "opacity 0.15s ease" }}>
          {/* An all-zero series still renders — an empty stretch of calendar is
              a real answer, and blanking the chart would hide the axis that
              says which stretch it was. */}
          {!hasData && !loading && (
            <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              No activity in this period
            </div>
          )}

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
                label={{
                  value: METRIC_AXIS_LABEL[metric],
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--text-muted)", fontSize: 11, textAnchor: "middle" },
                }}
              />
              <Tooltip content={<Tip />} cursor={{ fill: "var(--bg-subtle)" }} />
              <Bar dataKey="value" fill="var(--text)" opacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
